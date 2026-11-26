import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import {
    MAX_IMAGE_BYTES, MSG, RIGHTS_VERSION, SKILL_KEY_HEADER, isKakaoImageUrl, parseSkillRequest, type SkillResponse,
} from "@/lib/kakaoSkill";

/**
 * 카카오 i 오픈빌더 스킬 서버 (specs/017). 카카오톡 채널 «피카»(pf.kakao.com/_xoxdxkvX) 챗봇의 블록이 이 주소를 부른다.
 * - 비밀값: 스킬 설정의 «헤더값 입력»에 x-pica-skill-key 를 넣는다. 이 서버는 값을 갖고 있지 않고 DB 함수 kakao_intake()가
 *   해시(kakao_skill_keys)와 맞춰 본다. 그래서 Vercel 환경 변수·서비스 키가 필요 없다(anon 키 + DB 함수만, 헌장 III).
 * - 사진: 요청 안에서는 제출 줄만 만들고(빠름) 곧바로 답한다. 카카오 사진 주소(10분 유지)를 내려받아 비공개 버킷 leaflets 의
 *   kakao/<제출 id>.jpg 에 넣는 일은 답한 뒤(after) 한다. 그 경로는 방금 만든 줄이 있을 때만 익명이 한 번 넣을 수 있다.
 * - 이후는 013과 같다: 클로드 예약작업이 글자를 읽고(status read) 운영자가 /admin/leaflets 에서 확인해 «등록»해야 공개된다.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

type Intake = { ok: boolean; agreed?: boolean; id?: string; image_path?: string | null; attached?: boolean; error?: string };

async function intake(secret: string, userKey: string, action: string, text?: string): Promise<Intake> {
    const { data, error } = await supabase.rpc("kakao_intake", {
        p_secret: secret, p_user: userKey, p_action: action, p_text: text ?? null, p_rights: RIGHTS_VERSION,
    });
    if (error) return { ok: false, error: "db" };
    return (data ?? { ok: false, error: "db" }) as Intake;
}

async function storeImage(secret: string, id: string, path: string, url: string): Promise<void> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
        if (!isKakaoImageUrl(res.url || url)) throw new Error("redirected outside kakaocdn");
        const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(type)) throw new Error(`fetch ${res.status} ${type}`);
        const buf = await res.arrayBuffer();
        if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) throw new Error(`size ${buf.byteLength}`);
        const up = await supabase.storage.from("leaflets").upload(path, buf, { contentType: type, upsert: false });
        if (up.error) throw new Error(`upload ${up.error.message}`);
    } catch (e) {
        console.error("kakao image store failed", id, e instanceof Error ? e.message : e);
        await supabase.rpc("kakao_upload_failed", { p_secret: secret, p_id: id });
    }
}

const json = (r: SkillResponse) => NextResponse.json(r);

export async function POST(request: Request) {
    const secret = request.headers.get(SKILL_KEY_HEADER) || "";
    if (!secret) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
    const req = parseSkillRequest(body);
    if (!req) return NextResponse.json({ error: "bad request" }, { status: 400 });
    const { userKey, action } = req;

    if (action.kind === "welcome") {
        const r = await intake(secret, userKey, "status");
        if (r.error === "auth") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        if (!r.ok) return json(MSG.error());
        return json(r.agreed ? MSG.ready() : MSG.consent());
    }
    if (action.kind === "agree") {
        const r = await intake(secret, userKey, "agree");
        if (r.error === "auth") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        return json(r.ok ? MSG.agreed() : MSG.error());
    }
    if (action.kind === "text") {
        const r = await intake(secret, userKey, "text", action.text);
        if (r.error === "auth") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        if (r.error === "not_agreed") return json(MSG.consent());
        if (r.error === "daily_limit" || r.error === "site_limit") return json(MSG.limit());
        return json(r.ok ? MSG.gotText(!!r.attached) : MSG.error());
    }

    // 사진
    if (action.urls.length === 0) return json(MSG.noImage());
    const made: { id: string; path: string; url: string }[] = [];
    let refused = 0;
    for (const url of action.urls) {
        if (!isKakaoImageUrl(url)) continue;
        const r = await intake(secret, userKey, "image");
        if (r.error === "auth") return NextResponse.json({ error: "forbidden" }, { status: 403 });
        if (r.error === "not_agreed") return json(MSG.consent());
        if (r.ok && r.id && r.image_path) made.push({ id: r.id, path: r.image_path, url });
        else refused++;
    }
    if (made.length === 0) return json(refused ? MSG.limit() : MSG.error());
    after(async () => {
        for (const m of made) await storeImage(secret, m.id, m.path, m.url);
    });
    return json(MSG.gotImages(made.length, refused));
}
