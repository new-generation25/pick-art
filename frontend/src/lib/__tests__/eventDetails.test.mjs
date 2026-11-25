// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/eventDetails.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitDescription, isEndingSoon } from "../eventDetails.ts";

test("KOPIS 설명 줄을 칸으로, 나머지는 상세 안내에", () => {
    const d = "일시: 금요일(19:30), 토요일(11:00,14:00)\n관람료: 전석 40,000원\n관람연령: 만 5세 이상\n러닝타임: 1시간 40분\n출연: 유호진, 김민형\n장르: 서커스/마술";
    const { rows, rest } = splitDescription(d);
    assert.deepEqual(rows.map(r => r.label), ["공연 시각", "러닝타임", "출연", "장르"]);
    assert.equal(rows[0].value, "금요일(19:30), 토요일(11:00,14:00)");
    assert.equal(rest, "");
});

test("라벨 없는 설명은 그대로", () => {
    const d = "11월 정기공연입니다.\n문의: 055-000-0000";
    const { rows, rest } = splitDescription(d);
    assert.equal(rows.length, 0);
    assert.equal(rest, d);
});

test("곧 끝남: 7일 이상 + 0~7일 남음", () => {
    const T = "2026-11-26";
    assert.equal(isEndingSoon({ event_date_start: "2026-10-01", event_date_end: "2026-11-30" }, T), true);
    assert.equal(isEndingSoon({ event_date_start: "2026-10-01", event_date_end: "2026-11-26" }, T), true);
    assert.equal(isEndingSoon({ event_date_start: "2026-10-01", event_date_end: "2026-12-04" }, T), false);
    assert.equal(isEndingSoon({ event_date_start: "2026-11-27", event_date_end: "2026-11-28" }, T), false);
    assert.equal(isEndingSoon({ event_date_start: "2026-10-01", event_date_end: "2026-11-25" }, T), false);
    assert.equal(isEndingSoon({ event_date_start: null, event_date_end: null }, T), false);
});
