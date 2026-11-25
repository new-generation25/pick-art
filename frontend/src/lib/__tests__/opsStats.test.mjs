// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/opsStats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSupply, newByDay, lastNewByKind, sourceKind, kstDay, daysBetween, openWithin } from "../opsStats.ts";

const ev = (o) => ({ event_date_start: null, event_date_end: null, region: "김해", category: "공연", poster_image_url: "x", source: "KOPIS", created_at: null, ...o });
const T = "2026-11-25";

test("활성: 끝나는 날이 오늘 이후, 없으면 시작일", () => {
    const s = computeSupply([
        ev({ event_date_start: "2026-11-01", event_date_end: "2026-11-24" }),   // 끝남
        ev({ event_date_start: "2026-11-01", event_date_end: "2026-11-25" }),   // 오늘 끝
        ev({ event_date_start: "2026-11-30", event_date_end: null }),           // 시작일만
        ev({ event_date_start: null, event_date_end: null }),                    // 날짜 없음
    ], T, ["김해", "창원"]);
    assert.equal(s.active, 2);
    assert.deepEqual(s.emptyRegions, ["창원"]);
});

test("n일 안에 볼 수 있는 행사: 진행 중 포함, 먼 행사 제외", () => {
    assert.equal(openWithin(ev({ event_date_start: "2026-11-01", event_date_end: "2026-12-31" }), T, 7), true);
    assert.equal(openWithin(ev({ event_date_start: "2026-12-03", event_date_end: "2026-12-03" }), T, 7), false);
    assert.equal(openWithin(ev({ event_date_start: "2026-12-02", event_date_end: "2026-12-02" }), T, 7), true);
});

test("포스터 없는 활성 행사", () => {
    const s = computeSupply([ev({ event_date_end: "2026-12-01", poster_image_url: null }), ev({ event_date_end: "2026-12-01" })], T, ["김해"]);
    assert.equal(s.noPoster, 1);
});

test("출처 종류", () => {
    assert.equal(sourceKind("KOPIS"), "KOPIS");
    assert.equal(sourceKind("웹검색"), "큐레이션");
    assert.equal(sourceKind("인스타그램"), "인스타그램");
    assert.equal(sourceKind("창원문화재단"), "기관 공식");
    assert.equal(sourceKind(null), "기관 공식");
});

test("created_at 은 KST 날짜로 센다 (UTC 15시 = 다음 날 0시)", () => {
    assert.equal(kstDay("2026-11-24T15:30:00+00:00"), "2026-11-25");
    assert.equal(kstDay("2026-11-24T14:59:00+00:00"), "2026-11-24");
});

test("날짜별 새 행사: 7칸, 오래된 날이 앞, 종류별로 나눔", () => {
    const d = newByDay([
        ev({ created_at: "2026-11-25T01:00:00Z" }),
        ev({ created_at: "2026-11-25T02:00:00Z", source: "웹검색" }),
        ev({ created_at: "2026-11-19T01:00:00Z", source: "창원문화재단" }),
        ev({ created_at: "2026-11-18T01:00:00Z" }),   // 7일 밖
    ], T, 7);
    assert.equal(d.length, 7);
    assert.equal(d[0].day, "2026-11-19");
    assert.equal(d[0]["기관 공식"], 1);
    assert.equal(d[6].KOPIS, 1);
    assert.equal(d[6]["큐레이션"], 1);
});

test("종류별 마지막 새 행사 날짜와 날 수", () => {
    const last = lastNewByKind([ev({ created_at: "2026-11-19T01:00:00Z" }), ev({ created_at: "2026-11-17T01:00:00Z" })]);
    assert.equal(last.KOPIS, "2026-11-19");
    assert.equal(last["인스타그램"], null);
    assert.equal(daysBetween("2026-11-19", T), 6);
});
