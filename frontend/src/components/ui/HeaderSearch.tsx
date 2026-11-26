"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

/** 검색어를 붙일 피드 주소: 홈·지역 페이지면 그 자리에서(다른 필터 유지), 그 밖이면 홈으로 */
function feedTarget(pathname: string, current: URLSearchParams) {
    const onFeed = pathname === "/" || pathname.startsWith("/region/");
    return { path: onFeed ? pathname : "/", params: new URLSearchParams(onFeed ? current.toString() : "") };
}

function hrefOf(path: string, params: URLSearchParams) {
    params.delete("section"); // «모두 보기» 한 묶음 화면에서 찾거나 지우면 전체 묶음으로
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
}

/**
 * 맨 위 찾기 (Header). 주소에 검색어(q)가 있으면 열린 채로 그 검색어를 보여 준다.
 * X를 누르거나 글자를 다 지우면 주소의 q 만 빼서 검색 필터를 푼다(지역·분야 등 다른 필터는 그대로).
 */
export function HeaderSearch({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
    const router = useRouter();
    const pathname = usePathname() || "/";
    const searchParams = useSearchParams();
    const urlQ = searchParams.get("q") || "";
    const [value, setValue] = useState(urlQ);
    const input = useRef<HTMLInputElement>(null);
    // 글자를 지워 필터를 푼 경우에는 그사이 새로 친 글자를 주소 값으로 덮지 않는다
    const [keepTyped, setKeepTyped] = useState(false);

    // 주소의 검색어가 바뀌면(뒤로 가기·필터 풀기 등) 칸도 맞춘다 (렌더 중 맞추기, effect 안 씀)
    const [prevQ, setPrevQ] = useState(urlQ);
    if (urlQ !== prevQ) {
        setPrevQ(urlQ);
        if (keepTyped) setKeepTyped(false);
        else setValue(urlQ);
    }

    // 검색어가 있으면 찾기 칸을 열어 둔다(Header 의 로고 자리 계산에 쓰임)
    useEffect(() => { if (urlQ) setOpen(true); }, [urlQ, setOpen]);

    useEffect(() => { if (open && !urlQ) input.current?.focus(); }, [open, urlQ]);

    const dropQ = (replace = false) => {
        if (!urlQ) return;
        const { path, params } = feedTarget(pathname, searchParams);
        params.delete("q");
        const href = hrefOf(path, params);
        if (replace) router.replace(href); else router.push(href);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = value.trim();
        if (!q) { dropQ(); return; }
        const { path, params } = feedTarget(pathname, searchParams);
        params.set("q", q);
        router.push(hrefOf(path, params));
        input.current?.blur();
    };

    const close = () => {
        setValue("");
        dropQ();
        setOpen(false);
    };

    if (!open) {
        return (
            <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-ink transition-colors hover:bg-soft" aria-label="찾기" onClick={() => setOpen(true)}>
                <Search size={20} />
            </button>
        );
    }

    return (
        <form onSubmit={submit} role="search"
            className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-4 shadow-[0_1px_5px_rgba(30,26,21,.13)] sm:w-[360px] sm:flex-none">
            <Search size={18} className="shrink-0 text-ink-soft" aria-hidden />
            <input ref={input} name="q" type="search" enterKeyHint="search" value={value}
                onChange={(e) => {
                    const v = e.currentTarget.value;
                    setValue(v);
                    if (!v.trim() && urlQ) { setKeepTyped(true); dropQ(true); } // 글자를 다 지우면 검색 필터도 바로 푼다
                }}
                placeholder="행사 이름으로 찾기" aria-label="행사 이름으로 찾기"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden" />
            <button type="button" onClick={close} aria-label={urlQ ? "검색어 지우기" : "찾기 닫기"} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-soft hover:text-ink">
                <X size={18} />
            </button>
        </form>
    );
}
