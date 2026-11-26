// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/posters.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsTextPoster, posterSourceName, shortPeriod } from "../posters.ts";

test("짧은 날짜", () => {
    assert.equal(shortPeriod("2026-11-28", "2026-11-28"), "11.28");
    assert.equal(shortPeriod("2026-11-27", "2026-11-28"), "11.27–28");
    assert.equal(shortPeriod("2026-11-30", "2026-12-06"), "11.30–12.06");
    assert.equal(shortPeriod("2026-12-01", "2035-12-31"), "12.01–2035.12.31");
    assert.equal(shortPeriod(null, "2026-12-02"), "12.02");
    assert.equal(shortPeriod(null, null), "일정 미정");
});

test("포스터가 없거나 안내 그림이면 글자 포스터", () => {
    assert.equal(needsTextPoster({ poster_image_url: null }), true);
    assert.equal(needsTextPoster({ poster_image_url: "   " }), true);
    assert.equal(needsTextPoster({ poster_image_url: "https://x/p.webp", poster_placeholder: true }), true);
});

test("보통 포스터는 그대로", () => {
    assert.equal(needsTextPoster({ poster_image_url: "https://x/p.webp", poster_placeholder: false }), false);
    assert.equal(needsTextPoster({ poster_image_url: "https://x/p.webp" }), false);
});

test("출처 이름: 장소 → 출처, 모음 출처는 빼기", () => {
    assert.equal(posterSourceName({ venue: "김해서부문화센터", source: "KOPIS" }), "김해서부문화센터");
    assert.equal(posterSourceName({ venue: "", source: "김해문화관광재단" }), "김해문화관광재단");
    assert.equal(posterSourceName({ venue: null, source: "KOPIS" }), null);
    assert.equal(posterSourceName({ source: "단체 제공 · 극단 해연" }), "단체 제공 · 극단 해연");
});
