// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/nearby.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceM, formatDistance, periodRange, buildNearby } from "../nearby.ts";
import { naverRouteLinks, naverSearchUrl, detectPlatform } from "../naverMap.ts";

test("하버사인: 부산역↔해운대역 약 11.8km", () => {
  const d = distanceM({ lat: 35.1151, lng: 129.0415 }, { lat: 35.1631, lng: 129.1586 });
  assert.ok(Math.abs(d / 1000 - 11.8) < 0.3, String(d));
});

test("하버사인: 같은 점 0", () => {
  assert.equal(distanceM({ lat: 35, lng: 129 }, { lat: 35, lng: 129 }), 0);
});

test("거리 표기", () => {
  assert.equal(formatDistance(847), "850m");
  assert.equal(formatDistance(1234), "1.2km");
  assert.equal(formatDistance(1234, true), "약 1.2km");
  assert.equal(formatDistance(23400), "23km");
  assert.equal(formatDistance(3), "10m");
});

test("기간: 이번 주말(금요일 기준 토·일)", () => {
  assert.deepEqual(periodRange("weekend", "2026-11-20"), ["2026-11-21", "2026-11-22"]); // 금
  assert.deepEqual(periodRange("weekend", "2026-11-21"), ["2026-11-21", "2026-11-22"]); // 토
  assert.deepEqual(periodRange("weekend", "2026-11-22"), ["2026-11-22", "2026-11-22"]); // 일
  assert.deepEqual(periodRange("week", "2026-11-21"), ["2026-11-21", "2026-11-27"]);
});

const origin = { lat: 35.1532, lng: 129.1186 }; // 광안리
const ev = (id, start, end, coords, extra = {}) => ({
  id, title: id, venue: "장소" + id, region: "부산", category: "공연", event_date_start: start, event_date_end: end, coords, ...extra,
});
const events = [
  ev("far", "2026-11-21", "2026-11-21", { lat: 35.1151, lng: 129.0415 }), // 부산역 ~8km
  ev("near", "2026-11-25", "2026-11-25", { lat: 35.1535, lng: 129.1190 }), // 바로 옆
  ev("near-early", "2026-11-22", "2026-11-22", { lat: 35.1536, lng: 129.1191 }), // 같은 거리, 더 이름
  ev("nocoord", "2026-11-23", "2026-11-23", null),
  ev("novenue", "2026-11-23", "2026-11-23", null, { venue: "" }),
  ev("later", "2026-12-20", "2026-12-20", { lat: 35.1535, lng: 129.1190 }),
  ev("expo", "2026-11-01", "2026-12-31", { lat: 35.169, lng: 129.136 }, { category: "전시" }), // 진행 중 전시
];

test("정렬: 거리 → 같은 거리면 날짜", () => {
  const r = buildNearby(events, { origin, today: "2026-11-21", period: "week" });
  assert.deepEqual(r.near.map((e) => e.id), ["near-early", "near", "expo", "far"]);
  assert.deepEqual(r.unknown.map((e) => e.id), ["nocoord"]);
});

test("필터: 3km 안이면 먼 것과 좌표 없는 묶음 제외", () => {
  const r = buildNearby(events, { origin, today: "2026-11-21", period: "week", maxKm: 3 });
  assert.deepEqual(r.near.map((e) => e.id), ["near-early", "near", "expo"]);
  assert.equal(r.unknown.length, 0);
});

test("필터: 주말·분야", () => {
  const r = buildNearby(events, { origin, today: "2026-11-21", period: "weekend", category: "공연" });
  assert.deepEqual(r.near.map((e) => e.id), ["near-early", "far"]);
});

test("네이버 링크: iOS·좌표 있음", () => {
  const l = naverRouteLinks({ name: "어댑터씨어터", lat: 35.15, lng: 129.11, mode: "public", platform: "ios", appname: "pica.example" });
  assert.equal(l.primary, "nmap://route/public?dlat=35.15&dlng=129.11&dname=%EC%96%B4%EB%8C%91%ED%84%B0%EC%94%A8%EC%96%B4%ED%84%B0&appname=pica.example");
  assert.equal(l.fallback, naverSearchUrl("어댑터씨어터"));
  assert.ok(!l.primary.includes("slat"));
});

test("네이버 링크: 안드로이드 intent·자동차", () => {
  const l = naverRouteLinks({ name: "벡스코", lat: 35.169, lng: 129.136, mode: "car", platform: "android", appname: "pica.example" });
  assert.ok(l.primary.startsWith("intent://route/car?dlat=35.169&dlng=129.136"));
  assert.ok(l.primary.includes("package=com.nhn.android.nmap"));
});

test("네이버 링크: 좌표 없음·PC는 이름 검색", () => {
  const a = naverRouteLinks({ name: "작업실", region: "진주", mode: "public", platform: "ios", appname: "x" });
  assert.equal(a.primary, "https://map.naver.com/p/search/" + encodeURIComponent("작업실 진주"));
  const b = naverRouteLinks({ name: "벡스코", lat: 35.1, lng: 129.1, mode: "car", platform: "desktop", appname: "x" });
  assert.equal(b.primary, naverSearchUrl("벡스코"));
});

test("플랫폼 판별", () => {
  assert.equal(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "ios");
  assert.equal(detectPlatform("Mozilla/5.0 (Linux; Android 15)"), "android");
  assert.equal(detectPlatform("Mozilla/5.0 (Windows NT 10.0)"), "desktop");
});
