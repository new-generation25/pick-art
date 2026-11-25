// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/mapGroups.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByVenue, clusterGroups, zoomForRange, countLabel } from "../mapGroups.ts";

const it = (id, lat, lng, start, d = 1000) => ({ id, title: id, event_date_start: start, event_date_end: start, venue: "홀", region: "김해", coords: lat === null ? null : { lat, lng }, distanceM: d });

test("같은 좌표는 한 장소, 날짜 순, 가장 가까운 거리", () => {
    const g = groupByVenue([it("b", 35.2, 128.8, "2026-12-05", 900), it("a", 35.2, 128.8, "2026-11-30", 1200), it("c", 35.3, 128.9, "2026-11-28")]);
    assert.equal(g.length, 2);
    const hall = g.find(x => x.items.length === 2);
    assert.deepEqual(hall.items.map(x => x.id), ["a", "b"]);
    assert.equal(hall.distanceM, 900);
});

test("좌표 없는 행사는 지도에 넣지 않는다", () => {
    assert.equal(groupByVenue([it("x", null, null, "2026-11-28")]).length, 0);
});

test("축소하면 가까운 장소가 묶이고, 확대하면 나뉜다", () => {
    const g = groupByVenue([it("a", 35.230, 128.880, "2026-11-28"), it("b", 35.232, 128.882, "2026-11-28"), it("c", 35.100, 129.030, "2026-11-28")]);
    const far = clusterGroups(g, 9);
    const near = clusterGroups(g, 17);
    assert.ok(far.length < near.length);
    assert.equal(near.length, 3);
    assert.equal(far.reduce((s, c) => s + c.count, 0), 3);
});

test("확대 단계와 개수 글자", () => {
    assert.equal(zoomForRange("3"), 14);
    assert.equal(zoomForRange("all"), 9);
    assert.equal(countLabel(3), "3");
    assert.equal(countLabel(25), "20+");
});
