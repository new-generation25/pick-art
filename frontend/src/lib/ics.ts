/**
 * 캘린더(.ics, RFC 5545)와 구글 캘린더 추가 링크 (specs/008).
 * 행사는 날짜만 확실하므로(시각은 원문 글) 하루 종일 일정으로 만든다. 시각은 설명에 원문 그대로 넣는다(헌장 I).
 * 가져오는 모듈이 없어 node 테스트로 바로 돌린다.
 */

export type IcsEvent = {
    id: string;
    title: string;
    event_date_start: string | null;
    event_date_end: string | null;
    venue?: string | null;
    region?: string | null;
    description?: string | null;
    url: string; // 피카 상세 주소
};

const ymd = (d: string) => d.replace(/-/g, "");
function nextDay(d: string): string {
    const t = new Date(d + "T00:00:00Z");
    t.setUTCDate(t.getUTCDate() + 1);
    return t.toISOString().slice(0, 10);
}

/** TEXT 값 이스케이프 (\ ; , 줄바꿈) */
export function icsText(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 한 줄 75바이트(UTF-8)에서 접는다 */
export function foldLine(line: string): string {
    const enc = new TextEncoder();
    const out: string[] = [];
    let cur = "";
    for (const ch of line) {
        const limit = out.length === 0 ? 75 : 74; // 이어지는 줄은 앞 공백 1바이트
        if (enc.encode(cur + ch).length > limit) {
            out.push(cur);
            cur = ch;
        } else cur += ch;
    }
    out.push(cur);
    return out.join("\r\n ");
}

/** 행사 하나 → VEVENT 줄들. 날짜가 없으면 null */
export function vevent(e: IcsEvent, stamp: string): string[] | null {
    const start = e.event_date_start || e.event_date_end;
    const end = e.event_date_end || start;
    if (!start || !end) return null;
    const where = [e.venue, e.region].filter(Boolean).join(", ");
    const desc = [(e.description || "").slice(0, 600), `피카에서 보기: ${e.url}`].filter(Boolean).join("\n\n");
    return [
        "BEGIN:VEVENT",
        `UID:${e.id}@picka.news`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(start)}`,
        `DTEND;VALUE=DATE:${ymd(nextDay(end))}`, // 하루 종일 일정의 끝은 다음 날(포함하지 않음)
        `SUMMARY:${icsText(e.title)}`,
        ...(where ? [`LOCATION:${icsText(where)}`] : []),
        `DESCRIPTION:${icsText(desc)}`,
        `URL:${e.url}`,
        "END:VEVENT",
    ];
}

export function calendar(events: IcsEvent[], name: string, now = new Date()): string {
    const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//pica//picka.news//KO",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        `X-WR-CALNAME:${icsText(name)}`,
        "X-WR-TIMEZONE:Asia/Seoul",
        "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
        "X-PUBLISHED-TTL:PT12H",
        ...events.flatMap(e => vevent(e, stamp) || []),
        "END:VCALENDAR",
    ];
    return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** 구글 캘린더 「일정 추가」 링크 (하루 종일) */
export function googleCalendarUrl(e: IcsEvent): string | null {
    const start = e.event_date_start || e.event_date_end;
    const end = e.event_date_end || start;
    if (!start || !end) return null;
    const p = new URLSearchParams({
        action: "TEMPLATE",
        text: e.title,
        dates: `${ymd(start)}/${ymd(nextDay(end))}`,
        details: `피카에서 보기: ${e.url}`,
        location: [e.venue, e.region].filter(Boolean).join(", "),
    });
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
