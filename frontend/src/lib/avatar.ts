/**
 * 프로필 사진 (specs/022). 버킷 avatars(비공개) 의 <회원 id>/<파일 id>.jpg, 회원 기록 profiles.avatar_path.
 * 본인만 올리고·읽고·지운다(supabase/migrations/20261127160000_profile_avatar.sql).
 * 비공개 버킷이라 화면에는 1시간짜리 서명 주소로 보여 주고, 머리 줄이 화면마다 다시 받지 않게 50분 동안 기억한다.
 */
import { supabase } from "@/lib/supabase";

const BUCKET = "avatars";
const SIZE = 512;
const URL_TTL = 3600;
const KEEP_MS = 50 * 60 * 1000;
/** 사진이 바뀌면 머리 줄이 따라 바뀌게 알리는 이벤트. detail = 새 경로 또는 null */
export const AVATAR_EVENT = "pica:avatar";

/** 가운데를 정사각으로 잘라 512px JPEG 로 줄인다. 다시 그리면서 사진 위치(EXIF) 같은 정보가 빠진다 */
export async function squareJpeg(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
    if (!bitmap) throw new Error("decode");
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(SIZE, side);
    canvas.getContext("2d")!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", 0.88));
    if (!blob) throw new Error("encode");
    return blob;
}

function remember(path: string, url: string) {
    try { sessionStorage.setItem(`pica-avatar:${path}`, JSON.stringify({ url, at: Date.now() })); } catch { /* 저장소를 못 쓰면 매번 새로 받는다 */ }
}
function recall(path: string): string | null {
    try {
        const v = JSON.parse(sessionStorage.getItem(`pica-avatar:${path}`) || "null") as { url: string; at: number } | null;
        return v && Date.now() - v.at < KEEP_MS ? v.url : null;
    } catch { return null; }
}

/** 사진을 보여 줄 주소. 없거나 못 받으면 null */
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
    if (!path) return null;
    const kept = recall(path);
    if (kept) return kept;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_TTL);
    if (error || !data?.signedUrl) return null;
    remember(path, data.signedUrl);
    return data.signedUrl;
}

function announce(path: string | null) {
    window.dispatchEvent(new CustomEvent(AVATAR_EVENT, { detail: path }));
}

/** 새 사진을 올리고 회원 기록에 적는다. 옛 사진 파일은 지운다. 돌려주는 값: 새 경로 */
export async function uploadAvatar(userId: string, file: File, oldPath: string | null): Promise<string> {
    const blob = await squareJpeg(file);
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (up.error) throw new Error("upload");
    const { error } = await supabase.from("profiles").upsert({ id: userId, avatar_path: path, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) {
        await supabase.storage.from(BUCKET).remove([path]);   // 기록하지 못했으면 방금 올린 파일을 남기지 않는다
        throw new Error("save");
    }
    if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
    announce(path);
    return path;
}

/** 사진을 지운다(회원 기록의 칸을 비우고 파일을 지운다) */
export async function removeAvatar(userId: string, path: string): Promise<void> {
    const { error } = await supabase.from("profiles").update({ avatar_path: null, updated_at: new Date().toISOString() }).eq("id", userId);
    if (error) throw new Error("save");
    await supabase.storage.from(BUCKET).remove([path]);
    try { sessionStorage.removeItem(`pica-avatar:${path}`); } catch { /* 무시 */ }
    announce(null);
}
