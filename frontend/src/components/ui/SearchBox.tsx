"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextInput, CloseButton } from "@mantine/core";
import { Search } from "lucide-react";

// 홈 머리말의 행사 이름 검색. 글자가 있으면 오른쪽에 X가 생기고,
// 누르면 입력을 비우고 주소의 q 만 빼서 다른 필터는 그대로 둔다.
export function SearchBox({ initialQuery }: { initialQuery: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [value, setValue] = useState(initialQuery);

    const clear = () => {
        setValue("");
        if (!searchParams.get("q")) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
    };

    return (
        <form action="/" method="GET" className="mt-5" role="search">
            <TextInput
                name="q"
                value={value}
                onChange={(e) => setValue(e.currentTarget.value)}
                placeholder="행사 이름으로 찾기"
                aria-label="행사 이름으로 찾기"
                size="md"
                radius={0}
                leftSection={<Search size={18} />}
                rightSection={value ? <CloseButton aria-label="검색어 지우기" onClick={clear} /> : null}
                styles={{ input: { borderColor: 'var(--pk-line)', borderWidth: 1.5, backgroundColor: 'var(--pk-card)' } }}
            />
        </form>
    );
}
