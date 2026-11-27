// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/leaflets.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLeaflet, givenFields, leafletSource, isGroupProvided } from "../leaflets.ts";

const ok = { image_kind: "file", group_name: "극단 예시", official_url: "", title: "", date_text: "", venue: "", note: "", rights: [true] };
const img = { size: 1000, type: "image/jpeg" };

test("checkLeaflet: 다 채우면 통과", () => {
    assert.deepEqual(checkLeaflet(ok, img), []);
});

test("checkLeaflet: 이미지·종류·단체 이름·권리 체크가 빠지면 막는다", () => {
    const errs = checkLeaflet({ ...ok, image_kind: "", group_name: " ", rights: [false] }, null);
    assert.equal(errs.length, 4);
    assert.ok(checkLeaflet(ok, { size: 10, type: "application/pdf" }).length === 1);
    assert.ok(checkLeaflet({ ...ok, official_url: "instagram.com/x" }, img).length === 1);
    assert.deepEqual(checkLeaflet({ ...ok, official_url: "https://instagram.com/p/abc" }, img), []);
});

test("givenFields: 빈 칸은 빼고 다듬는다", () => {
    assert.deepEqual(givenFields({ ...ok, title: "  봄 연주회 ", venue: "" }), { title: "봄 연주회" });
});

test("출처 글자와 단체 제공 판별", () => {
    assert.equal(leafletSource(" 극단 예시 "), "단체 제공 · 극단 예시");
    assert.ok(isGroupProvided("단체 제공 · 극단 예시"));
    assert.ok(!isGroupProvided("KOPIS"));
    assert.ok(!isGroupProvided(null));
});
