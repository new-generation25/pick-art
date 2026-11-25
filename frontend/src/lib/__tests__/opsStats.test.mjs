// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/opsStats.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    computeSupply, newByDay, lastNewByKind, sourceKind, kstDay, daysBetween, openWithin,
    latestRunRows, foundSeries, checkMissedRun, splitCollectorAlerts, runStatusTone, ALERT_RULES,
} from "../opsStats.ts";

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

// ── 수집기 실행 기록 (contracts/ops-snapshots.md) ──
const run = (o) => ({ run_at: "2026-11-26T08:20:05+09:00", source: "KOPIS", kind: "kopis", status: "SUCCESS", found: 1, new: 0, dup: 1, fail: 0, note: "", ...o });
const R2 = "2026-11-26T08:20:05+09:00", R1 = "2026-11-25T15:00:03+09:00", R0 = "2026-11-25T08:20:00+09:00";
const runs = [
    run({ run_at: R2, source: "KOPIS", found: 194 }),
    run({ run_at: R2, source: "김해문화재단", kind: "website", found: 3 }),
    run({ run_at: R2, source: "자동 공개", kind: "publish", found: 5, new: null, dup: null, fail: null }),
    run({ run_at: R1, source: "KOPIS", found: 0 }),
    run({ run_at: R1, source: "옛 블로그", kind: "blog", found: 2 }),
    run({ run_at: R0, source: "KOPIS", found: 7 }),
];

test("마지막 실행 줄: 가장 늦은 run_at 만, 실행 순서 유지 (자동 공개 포함)", () => {
    const l = latestRunRows(runs);
    assert.deepEqual(l.map(r => r.source), ["KOPIS", "김해문화재단", "자동 공개"]);
    assert.deepEqual(latestRunRows([]), []);
    // 오프셋이 달라도 같은 순간이면 같은 실행
    assert.equal(latestRunRows([run({ run_at: "2026-11-25T23:20:05Z", source: "A" }), run({ run_at: R2, source: "B" })]).length, 2);
    // 읽을 수 없는 시각은 버린다
    assert.deepEqual(latestRunRows([run({ run_at: "x" })]), []);
});

test("출처별 최근 10회 found: 오래된 것이 앞, 마지막 실행 출처가 먼저", () => {
    const s = foundSeries(runs);
    assert.deepEqual(s.map(x => x.source), ["KOPIS", "김해문화재단", "자동 공개", "옛 블로그"]);
    assert.deepEqual(s[0].points.map(p => p.found), [7, 0, 194]);
    const many = Array.from({ length: 15 }, (_, i) => run({ run_at: new Date(Date.UTC(2026, 10, 1 + i)).toISOString(), found: i }));
    const k = foundSeries(many)[0].points.map(p => p.found);
    assert.equal(k.length, 10);
    assert.deepEqual(k, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    // found 가 없으면 0
    assert.deepEqual(foundSeries([run({ found: null })])[0].points[0].found, 0);
});

test("실행 누락: 14시간 넘으면 missed, 기록 없으면 none", () => {
    assert.equal(ALERT_RULES.collectorRunMissHours, 14);
    const at = Date.parse(R2);
    assert.deepEqual(checkMissedRun(undefined, at), { state: "none" });
    assert.deepEqual(checkMissedRun([], at), { state: "none" });
    assert.equal(checkMissedRun(runs, at + 14 * 3600000).state, "ok");
    const m = checkMissedRun(runs, at + 14 * 3600000 + 60000);
    assert.equal(m.state, "missed");
    assert.equal(m.lastRunAt, R2);
    assert.ok(m.hours > 14 && m.hours < 14.1);
});

test("수집기 경고: 켜진 것(bad 먼저)과 7일 안에 풀린 것", () => {
    const now = Date.parse("2026-11-26T12:00:00+09:00");
    const al = [
        { rule: "zero_found", target: "A", level: "warn", text: "w1", resolved_at: null },
        { rule: "source_fail", target: "B", level: "bad", text: "b1", resolved_at: null },
        { rule: "zero_found", target: "C", level: "warn", text: "r-old", resolved_at: "2026-11-18T12:00:00+09:00" },
        { rule: "zero_found", target: "D", level: "warn", text: "r-1", resolved_at: "2026-11-24T08:20:00+09:00" },
        { rule: "zero_found", target: "E", level: "warn", text: "r-2", resolved_at: "2026-11-26T08:20:00+09:00" },
        { rule: "zero_found", target: "F", level: "warn", text: "w2" },   // resolved_at 칸이 없어도 켜진 것
    ];
    const { open, resolved } = splitCollectorAlerts(al, now);
    assert.deepEqual(open.map(a => a.text), ["b1", "w1", "w2"]);
    assert.deepEqual(resolved.map(a => a.text), ["r-2", "r-1"]);
});

test("실행 상태 색 갈래", () => {
    assert.equal(runStatusTone("SUCCESS"), "ok");
    assert.equal(runStatusTone("FAILED"), "bad");
    assert.equal(runStatusTone("error"), "bad");
    assert.equal(runStatusTone("PARTIAL"), "other");
    assert.equal(runStatusTone(undefined), "other");
});
