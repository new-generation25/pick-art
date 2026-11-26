// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/posters.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsTextPoster, posterSourceName } from "../posters.ts";

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
