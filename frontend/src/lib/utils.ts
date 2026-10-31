import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** '2026-11-04','2026-11-06' -> '2026.11.04 ~ 11.06', 같은 날이면 '2026.11.04' */
export function formatPeriod(start?: string | null, end?: string | null): string {
    const f = (d: string) => d.replace(/-/g, ".");
    if (!start) return end ? f(end) : "일정 미정";
    if (!end || end === start) return f(start);
    if (start.slice(0, 4) === end.slice(0, 4)) return `${f(start)} ~ ${f(end).slice(5)}`;
    return `${f(start)} ~ ${f(end)}`;
}

/** 오늘 날짜 'YYYY-MM-DD' (한국 시간) */
export function todayKST(): string {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
