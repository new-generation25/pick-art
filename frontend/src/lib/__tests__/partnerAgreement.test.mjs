// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/partnerAgreement.test.mjs
// 협약 신청의 활동 분야(선택, 운영자 2026-11-28): 고르지 않아도 보내지고, 목록에 있는 값만 목록 순서로 저장된다
import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIVITY_FIELD_VALUES, EMPTY_AGREEMENT, checkAgreement, toRow } from "../partnerAgreement.ts";

const ok = { ...EMPTY_AGREEMENT, applicant_type: "org", org_name: "극단 시험", official_url: "https://instagram.com/test_group", contact_private: "010-0000-0000",
    agree_listing: true, agree_collect: true, agree_confirm: true, agree_privacy: true, image_use: "yes" };

test("분야를 고르지 않아도 검사를 통과하고 빈 배열로 저장된다", () => {
    assert.deepEqual(checkAgreement(ok), []);
    assert.deepEqual(toRow(ok).fields, []);
});

test("목록에 있는 값만, 목록 순서로", () => {
    const row = toRow({ ...ok, fields: ["회화·드로잉", "연극", "해킹", "연극"] });
    assert.deepEqual(row.fields, ["연극", "회화·드로잉"]);
});

test("목록은 DB 함수의 allowed 와 같은 22개(«기획» 포함)", () => {
    assert.equal(ACTIVITY_FIELD_VALUES.length, 22);
    assert.equal(new Set(ACTIVITY_FIELD_VALUES).size, 22);
    assert.deepEqual(toRow({ ...ok, fields: ["기획"] }).fields, ["기획"]);
});

test("번호: 누구인가요 ①, 동의 ③", () => {
    const errs = checkAgreement(EMPTY_AGREEMENT);
    assert.ok(errs.some(e => e.startsWith("① 개인인지")));
    assert.ok(errs.some(e => e.startsWith("③ «전체 동의»")));
});
