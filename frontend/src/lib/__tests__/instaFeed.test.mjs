// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/instaFeed.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByPostedDay, dayLabel, regionCounts } from "../instaFeed.ts";

const r = (id, posted, start, end, region = "김해") => ({ id, insta_posted_at: posted, event_date_start: start, event_date_end: end, region });
const T = "2026-11-26";

test("소개한 날 최신순, 같은 날 안에서는 안 끝난 것 먼저·빨리 열리는 순", () => {
    const g = groupByPostedDay([
        r("a", "2026-11-24", "2026-11-28", "2026-11-28"),
        r("b", "2026-11-25", "2026-12-05", "2026-12-05"),
        r("c", "2026-11-25", "2026-11-20", "2026-11-25"),   // 끝남
        r("d", "2026-11-25", "2026-11-27", "2026-11-27"),
        r("e", null, "2026-11-27", "2026-11-27"),            // 날짜 없음 → 뺌
    ], T);
    assert.deepEqual(g.map(x => x.day), ["2026-11-25", "2026-11-24"]);
    assert.deepEqual(g[0].items.map(x => x.id), ["d", "b", "c"]);
});

test("날짜 이름", () => {
    assert.equal(dayLabel("2026-11-25"), "11월 25일 (수)");
});

test("지역 칩은 있는 지역만, 많은 순", () => {
    const c = regionCounts([r("a", T, T, T, "부산"), r("b", T, T, T, "김해"), r("c", T, T, T, "부산"), r("d", T, T, T, null)]);
    assert.deepEqual(c, [{ region: "부산", n: 2 }, { region: "김해", n: 1 }]);
});
