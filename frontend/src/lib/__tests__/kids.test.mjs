// 실행(frontend 폴더): node --experimental-strip-types --test src/lib/__tests__/kids.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { kidsInfo, parseMinMonths, fitsAge, ageLabel, readKidsParam } from "../kids.ts";

test("관람 연령 표기 읽기", () => {
    assert.equal(parseMinMonths("만 7세 이상"), 84);
    assert.equal(parseMinMonths("36개월 이상"), 36);
    assert.equal(parseMinMonths("전체 관람가"), 0);
    assert.equal(parseMinMonths("초등학생 이상"), 84);
    assert.equal(parseMinMonths("미취학 아동 입장 불가"), 84);
    assert.equal(parseMinMonths("청소년 관람 불가"), 228);
    assert.equal(parseMinMonths("8세 이상(2019년 이전 출생자)"), 96);
    assert.equal(parseMinMonths(null), null);
    assert.equal(parseMinMonths("문의 바람"), null);
});

test("KOPIS 설명 줄에서 원문과 하한", () => {
    const i = kidsInfo({ title: "어린이 서커스 쇼 [김해]", description: "일시: 토요일(11:00)\n관람연령: 24개월 이상\n장르: 서커스" });
    assert.equal(i.group, "target");
    assert.equal(i.minMonths, 24);
    assert.equal(i.ageText, "24개월 이상");
});

test("아이 대상 낱말·예외 낱말", () => {
    assert.equal(kidsInfo({ title: "가족뮤지컬 〈호두까기 인형〉" }).group, "target");
    assert.equal(kidsInfo({ title: "아이돌 콘서트" }).group, null);
    assert.equal(kidsInfo({ title: "A Child of Our Time 가족 송년" }).group, null);
    assert.equal(kidsInfo({ title: "[성인대상] 어린이 그림책 강좌" }).group, null);
});

test("13세 이상이면 아이 낱말이 있어도 뺀다", () => {
    assert.equal(kidsInfo({ title: "가족 연극", description: "관람연령: 만 13세 이상" }).group, null);
});

test("아이도 볼 수 있음 = 아이 대상 아님 + 하한 12세 이하", () => {
    assert.equal(kidsInfo({ title: "정기연주회", description: "관람연령: 만 7세 이상" }).group, "ok");
    assert.equal(kidsInfo({ title: "정기연주회", description: "" }).group, null);
});

test("운영자 수정이 규칙보다 앞선다", () => {
    assert.equal(kidsInfo({ title: "어린이 서커스", kids_override: "none" }).group, null);
    assert.equal(kidsInfo({ title: "정기연주회", kids_override: "target" }).group, "target");
});

test("나이 고르기", () => {
    const seven = kidsInfo({ title: "어린이 연극", description: "관람연령: 만 7세 이상" });
    assert.equal(fitsAge(seven, "young"), false);
    assert.equal(fitsAge(seven, "school"), true);
    const unknown = kidsInfo({ title: "어린이 체험" });
    assert.equal(fitsAge(unknown, "young"), true);
    assert.equal(fitsAge(kidsInfo({ title: "정기연주회" }), null), false);
});

test("표시 글자·주소 값", () => {
    assert.equal(ageLabel(null), "나이 정보 없음");
    assert.equal(ageLabel(0), "전체 관람");
    assert.equal(ageLabel(24), "24개월+");
    assert.equal(ageLabel(84), "만 7세+");
    assert.deepEqual(readKidsParam("young"), { on: true, age: "young" });
    assert.deepEqual(readKidsParam("any"), { on: true, age: null });
    assert.deepEqual(readKidsParam(undefined), { on: false, age: null });
});
