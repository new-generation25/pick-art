"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { GN_REGIONS } from "@/lib/regions";
import { CATEGORIES } from "@/lib/categories";

// 구글·카카오 첫 로그인 직후의 가입 화면(3단계): 지역 → 관심 분야 → 닉네임.
// 지역과 관심 분야는 홈의 자동 지역 적용과 노출 순서에 쓰이므로 고르지 않으면 다음으로 넘어가지 않는다.
// 닉네임은 구글 실명이 그대로 공개되지 않도록 자동 이름을 제안한다.
const STEPS = ["지역", "관심 분야", "닉네임"];

export default function WelcomePage() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [step, setStep] = useState(0);
    const [region, setRegion] = useState("");
    const [autoRegion, setAutoRegion] = useState(true);
    const [interests, setInterests] = useState<string[]>([]);
    const [nickname, setNickname] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                router.replace("/login");
                return;
            }
            setUserId(session.user.id);
            const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
            setRegion(profile?.region || "");
            setAutoRegion(profile?.auto_region ?? true);
            setInterests((profile?.interests || []).filter((i: string) => CATEGORIES.includes(i)));
            setNickname(profile?.nickname || `픽아트회원${session.user.id.slice(0, 4)}`);
        })();
    }, [router]);

    const canNext = step === 0 ? !!region : step === 1 ? interests.length > 0 : nickname.trim().length > 0;

    const save = async () => {
        if (!userId) return;
        setSaving(true);
        setError(null);
        const { error } = await supabase.from("profiles").upsert({
            id: userId,
            nickname: nickname.trim(),
            region,
            auto_region: autoRegion,
            interests,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
        if (error) {
            setError(`저장하지 못했습니다: ${error.message}`);
            setSaving(false);
            return;
        }
        router.replace("/");
    };

    const toggleInterest = (c: string) =>
        setInterests(interests.includes(c) ? interests.filter(i => i !== c) : [...interests, c]);

    if (!userId) {
        return <main className="flex min-h-[60vh] items-center justify-center"><p className="font-bold text-ink-soft">불러오는 중...</p></main>;
    }

    return (
        <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
            <p className="text-[14px] font-bold text-accent">가입 {step + 1} / {STEPS.length} · {STEPS[step]}</p>
            <div className="mt-2 flex gap-1.5" aria-hidden>
                {STEPS.map((s, i) => (
                    <span key={s} className="h-1.5 flex-1" style={{ background: i <= step ? "var(--pk-ink)" : "var(--pk-line)", opacity: i <= step ? 1 : 0.25 }} />
                ))}
            </div>

            {step === 0 && (
                <section className="mt-6">
                    <h1 className="pica-display text-[30px] leading-tight text-ink">어느 지역 행사를 먼저 볼까요?</h1>
                    <p className="mt-2 text-[15px] text-ink-soft">사는 곳이나 자주 가는 곳을 골라 주세요. 나중에 설정에서 바꿀 수 있습니다.</p>
                    <div className="pica-chiprow mt-5 flex-wrap" role="group" aria-label="지역">
                        {[...GN_REGIONS, "기타"].map(r => (
                            <button key={r} type="button" className="pica-chip" aria-pressed={region === r} onClick={() => setRegion(r)}>{r}</button>
                        ))}
                    </div>
                    <label className="mt-5 flex items-start gap-2 text-[14px] text-ink">
                        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={autoRegion} onChange={e => setAutoRegion(e.target.checked)} />
                        <span><b>내 지역 자동 적용</b><span className="block text-[13px] text-ink-soft">홈에 들어오면 이 지역 행사만 먼저 보여 줍니다. 홈에서 언제든 전체로 바꿀 수 있습니다.</span></span>
                    </label>
                </section>
            )}

            {step === 1 && (
                <section className="mt-6">
                    <h1 className="pica-display text-[30px] leading-tight text-ink">어떤 행사를 좋아하세요?</h1>
                    <p className="mt-2 text-[15px] text-ink-soft">하나 이상 골라 주세요. 고른 분야를 같은 날짜 안에서 먼저 보여 줍니다.</p>
                    <div className="pica-chiprow mt-5 flex-wrap" role="group" aria-label="관심 분야">
                        {CATEGORIES.map(c => (
                            <button key={c} type="button" className="pica-chip" aria-pressed={interests.includes(c)} onClick={() => toggleInterest(c)}>{c}</button>
                        ))}
                    </div>
                </section>
            )}

            {step === 2 && (
                <section className="mt-6">
                    <h1 className="pica-display text-[30px] leading-tight text-ink">다른 사람에게 보일 이름</h1>
                    <p className="mt-2 text-[15px] text-ink-soft">구글 계정의 실명 대신 쓸 닉네임입니다. 그대로 두어도 됩니다.</p>
                    <input
                        value={nickname}
                        onChange={e => setNickname(e.target.value)}
                        maxLength={20}
                        aria-label="닉네임"
                        className="mt-5 w-full border-[1.5px] border-line bg-card px-4 py-3 text-[16px] font-medium text-ink outline-none"
                    />
                </section>
            )}

            {error && <p className="mt-4 text-[14px] font-bold text-red-600">{error}</p>}

            <div className="mt-8 flex gap-2">
                {step > 0 && (
                    <button type="button" className="pica-chip" onClick={() => setStep(step - 1)}>이전</button>
                )}
                <button
                    type="button"
                    disabled={!canNext || saving}
                    onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : save())}
                    className="flex-1 bg-ink px-5 py-3 text-[16px] font-bold text-paper disabled:opacity-40"
                >
                    {step < STEPS.length - 1 ? "다음" : saving ? "저장 중..." : "시작하기"}
                </button>
            </div>
        </main>
    );
}
