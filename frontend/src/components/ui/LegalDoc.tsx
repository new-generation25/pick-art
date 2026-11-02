/** 이용약관·개인정보처리방침 공용 틀: 제목, 시행일, 절 */
export function LegalDoc({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
    return (
        <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14 text-ink">
            <h1 className="pica-display text-[30px] sm:text-[36px] leading-tight">{title}</h1>
            <p className="mt-2 text-[14px] text-ink-soft">시행일 {effective}</p>
            <div className="mt-8 space-y-8 text-[15px] leading-[1.75]">{children}</div>
            <p className="mt-12 border-t-[1.5px] border-line pt-4 text-[13px] text-ink-soft">이 문서는 {effective}부터 적용됩니다.</p>
        </main>
    );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="text-[18px] font-bold">제{n}조 {title}</h2>
            <div className="mt-2 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_td]:border [&_th]:border [&_td]:border-line [&_th]:border-line [&_td]:px-2 [&_th]:px-2 [&_td]:py-1 [&_th]:py-1 [&_th]:text-left [&_td]:align-top">
                {children}
            </div>
        </section>
    );
}
