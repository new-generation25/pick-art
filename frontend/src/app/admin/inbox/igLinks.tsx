// 관리자 판단 카드의 @계정을 인스타그램 링크로 (운영자 2026-11-28 «판별 카드 안에 골뱅이 @가 있을 경우 인스타그램 링크로 이동»).
// 계정 이름 규칙(영문·숫자·밑줄·점, 30자까지)에 맞는 것만 잇는다. 메일 주소(a@b.com)처럼 앞에 글자가 붙은 @는 잇지 않는다.
import type { ReactNode } from "react";

const HANDLE = /(^|[^A-Za-z0-9._@])@([A-Za-z0-9._]{1,30})/g;

export const igUrl = (handle: string) => `https://www.instagram.com/${handle.replace(/^@+/, "").replace(/\.+$/, "")}/`;

/** @계정 하나를 링크로. 카드를 눌러 여는 자세히 보기는 링크를 누르면 열리지 않는다(opensDetail 이 a 를 뺀다) */
export function IgHandle({ handle, className }: { handle: string; className?: string }) {
    const h = handle.replace(/^@+/, "");
    return (
        <a href={igUrl(h)} target="_blank" rel="noopener noreferrer" className={className ?? "pica-ig"}
            onClick={(e) => e.stopPropagation()} aria-label={`@${h} 인스타그램 열기`}>@{h}</a>
    );
}

/** 글 속 @계정을 링크로 바꾼 조각들. 끝에 붙은 점(문장 끝 마침표)은 링크에서 뺀다 */
export function withIgLinks(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of text.matchAll(HANDLE)) {
        const start = (m.index ?? 0) + m[1].length;
        const raw = m[2];
        const handle = raw.replace(/\.+$/, "");
        if (!handle) continue;
        out.push(text.slice(last, start));
        out.push(<IgHandle key={start} handle={handle} />);
        last = start + 1 + handle.length;
    }
    out.push(text.slice(last));
    return out;
}
