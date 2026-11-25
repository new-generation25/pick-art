// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/ics.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { calendar, vevent, icsText, foldLine, googleCalendarUrl } from "../ics.ts";

const ev = { id: "abc", title: "어린이 서커스 쇼, [김해]", event_date_start: "2026-11-28", event_date_end: "2026-11-28", venue: "칠암문화센터", region: "김해", description: "일시: 토요일(11:00)", url: "https://picka.news/events/abc" };

test("하루 종일: 끝은 다음 날", () => {
    const v = vevent(ev, "20261126T000000Z");
    assert.ok(v.includes("DTSTART;VALUE=DATE:20261128"));
    assert.ok(v.includes("DTEND;VALUE=DATE:20261129"));
});

test("여러 날 행사", () => {
    const v = vevent({ ...ev, event_date_start: "2026-11-01", event_date_end: "2026-12-31" }, "x");
    assert.ok(v.includes("DTEND;VALUE=DATE:20270101"));
});

test("날짜 없으면 넣지 않는다", () => {
    assert.equal(vevent({ ...ev, event_date_start: null, event_date_end: null }, "x"), null);
});

test("글자 이스케이프", () => {
    assert.equal(icsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
});

test("75바이트 접기 (한글 3바이트)", () => {
    const line = "SUMMARY:" + "가".repeat(40);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) assert.ok(new TextEncoder().encode(part).length <= 75);
    assert.equal(folded.replace(/\r\n /g, ""), line);
});

test("달력 전체 모양", () => {
    const c = calendar([ev, { ...ev, id: "x", event_date_start: null, event_date_end: null }], "피카 김해", new Date("2026-11-26T00:00:00Z"));
    assert.ok(c.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(c.endsWith("END:VCALENDAR\r\n"));
    assert.equal(c.split("BEGIN:VEVENT").length - 1, 1);
});

test("구글 캘린더 링크", () => {
    const u = new URL(googleCalendarUrl(ev));
    assert.equal(u.searchParams.get("dates"), "20261128/20261129");
    assert.equal(u.searchParams.get("text"), ev.title);
});
