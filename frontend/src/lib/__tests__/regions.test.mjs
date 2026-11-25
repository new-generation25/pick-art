import { test } from "node:test";
import assert from "node:assert/strict";
import { regionPath, regionFromPath, regionFromSlug, districtFromSlug, REGION_SLUGS, GN_REGIONS, BUSAN_DISTRICTS } from "../regions.ts";

test("모든 지역에 로마자 주소가 있고 겹치지 않는다", () => {
    assert.deepEqual(Object.keys(REGION_SLUGS).sort(), [...GN_REGIONS].sort());
    assert.equal(new Set(Object.values(REGION_SLUGS)).size, GN_REGIONS.length);
    assert.equal(BUSAN_DISTRICTS.length, 16);
    assert.equal(new Set(BUSAN_DISTRICTS.map(d => d.slug)).size, 16);
});

test("주소 만들기", () => {
    assert.equal(regionPath("김해"), "/region/gimhae");
    assert.equal(regionPath("부산", "해운대구"), "/region/busan/haeundae");
    assert.equal(regionPath("김해", "해운대구"), "/region/gimhae");
    assert.equal(regionPath("전체"), "/");
    assert.equal(regionPath(null), "/");
});

test("주소 읽기: 로마자·한글·대문자", () => {
    assert.equal(regionFromSlug("gimhae"), "김해");
    assert.equal(regionFromSlug("GIMHAE"), "김해");
    assert.equal(regionFromSlug(encodeURIComponent("김해")), "김해");
    assert.equal(regionFromSlug("seoul"), null);
    assert.equal(districtFromSlug("haeundae"), "해운대구");
    assert.equal(districtFromSlug("해운대"), "해운대구");
    assert.equal(districtFromSlug("gijang"), "기장군");
    assert.deepEqual(regionFromPath("/region/busan/suyeong"), { region: "부산", district: "수영구" });
    assert.deepEqual(regionFromPath("/region/gimhae/suyeong"), { region: "김해", district: null });
    assert.deepEqual(regionFromPath("/events/1"), { region: null, district: null });
});
