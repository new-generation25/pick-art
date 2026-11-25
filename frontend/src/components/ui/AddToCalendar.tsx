import { CalendarPlus } from "lucide-react";
import { googleCalendarUrl, type IcsEvent } from "@/lib/ics";

/** 행사 상세의 「내 캘린더에 추가」 (specs/008): 구글 캘린더 링크 + .ics(애플·삼성·아웃룩) */
export function AddToCalendar({ event }: { event: IcsEvent }) {
    const google = googleCalendarUrl(event);
    if (!google) return null;
    const link = "inline-flex items-center gap-1 underline-offset-4 hover:text-ink hover:underline";
    return (
        <p className="mx-auto mt-3 flex max-w-[400px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-semibold text-ink-soft">
            <span className="inline-flex items-center gap-1"><CalendarPlus className="h-4 w-4" aria-hidden /> 내 캘린더에 추가</span>
            <a href={google} target="_blank" rel="noopener noreferrer" className={link}>구글</a>
            <a href={`/events/${event.id}/ics`} className={link}>애플·기타(.ics)</a>
        </p>
    );
}
