// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/eventCounts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthRange, totalsByEvent, toCsv } from "../eventCounts.ts";

test("monthRange: 달의 첫날·마지막 날 (윤년 2월 포함)", () => {
    assert.deepEqual(monthRange("2026-11"), { from: "2026-11-01", to: "2026-11-30" });
    assert.deepEqual(monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
    assert.deepEqual(monthRange("2026-12"), { from: "2026-12-01", to: "2026-12-31" });
});

test("totalsByEvent: 종류별로 더하고 클릭은 원본·캘린더·공유 합", () => {
    const t = totalsByEvent([
        { event_id: "a", day: "2026-11-01", kind: "view", n: 3 },
        { event_id: "a", day: "2026-11-02", kind: "view", n: 2 },
        { event_id: "a", day: "2026-11-02", kind: "outbound", n: 1 },
        { event_id: "b", day: "2026-11-02", kind: "view", n: 9 },
        { event_id: "b", day: "2026-11-02", kind: "share", n: 2 },
        { event_id: "b", day: "2026-11-03", kind: "calendar", n: 1 },
    ]);
    assert.equal(t[0].event_id, "b");
    assert.deepEqual(t[0], { event_id: "b", view: 9, outbound: 0, calendar: 1, share: 2, clicks: 3 });
    assert.deepEqual(t[1], { event_id: "a", view: 5, outbound: 1, calendar: 0, share: 0, clicks: 1 });
});

test("toCsv: BOM, 쉼표·따옴표 감싸기", () => {
    const csv = toCsv(["행사", "조회"], [["a, \"b\"", 3]]);
    assert.ok(csv.startsWith("﻿"));
    assert.equal(csv.slice(1), '행사,조회\r\n"a, ""b""",3');
});
