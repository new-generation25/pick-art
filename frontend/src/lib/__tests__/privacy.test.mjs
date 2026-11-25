// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/privacy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPersonalPhones, hasPersonalPhone, MASK_TEXT } from "../privacy.ts";

test("휴대전화는 가린다 (여러 꼴)", () => {
    for (const s of ["문의 010-1234-5678", "문의 010 1234 5678", "문의 01012345678", "문의 010.123.4567", "문의 +82-10-1234-5678", "011-123-4567"]) {
        assert.ok(hasPersonalPhone(s), s);
        assert.ok(maskPersonalPhones(s).includes(MASK_TEXT), s);
        assert.ok(!/\d{4}\D?\d{4}$/.test(maskPersonalPhones(s)), s);
    }
});

test("유선·대표번호·날짜·요금은 그대로", () => {
    for (const s of ["문의 055-330-1234", "1588-1234", "051-123-4567", "2026.12.18 19:30", "전석 20,000원", "공연번호 20261218"]) {
        assert.equal(maskPersonalPhones(s), s);
        assert.ok(!hasPersonalPhone(s), s);
    }
});

test("한 글에 여러 번호, 빈 값", () => {
    assert.equal(maskPersonalPhones("A 010-1111-2222 / B 010-3333-4444"), `A ${MASK_TEXT} / B ${MASK_TEXT}`);
    assert.equal(maskPersonalPhones(null), null);
    assert.equal(maskPersonalPhones(""), "");
});
