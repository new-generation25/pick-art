// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/dupRules.test.mjs
// collector/dedupe.py 시험과 같은 사례: 공개 승인 전 중복 확인이 공개 단계와 같은 판정을 내는지
import { test } from "node:test";
import assert from "node:assert/strict";
import { loose, similar, sameEvent } from "../dupRules.ts";

test("지역 꼬리표·연극 접두·연도·기호를 빼고 견준다", () => {
    assert.equal(loose("연극 <해무> [부산]"), "해무");
    assert.ok(sameEvent("한화클래식 2026: 피아노 × 첼로", "한화클래식: 피아노 x 첼로"));
    assert.ok(sameEvent("콘서트누리, 플라워", "콘서트누리 ⨉ 플라워"));
});

test("짧은 쪽이 3글자 이상일 때만 포함으로 본다", () => {
    assert.ok(similar("해무", "해무"));
    assert.ok(!similar("쇼", "매직쇼"));
    assert.ok(sameEvent("더 매직 서커스", "고향의봄도서관 더 매직 서커스"));
});

test("낱말 순서만 다른 제목도 같은 행사", () => {
    assert.ok(sameEvent("제82회 부산시립교향악단 기획음악회: 청소년 협주곡의 밤 [부산]", "부산시립교향악단 기획음악회 제82회 청소년 협주곡의 밤"));
});

test("다른 행사는 같다고 하지 않는다", () => {
    assert.ok(!sameEvent("브레멘 음악대", "요술 항아리"));
    assert.ok(!sameEvent("크리스마스 콘서트", "송년 음악회"));
});
