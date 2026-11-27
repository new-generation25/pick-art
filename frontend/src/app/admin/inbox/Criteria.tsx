"use client";

// 대기함의 갈래별 판단 기준을 한 번에 보여 준다 (specs/019 A7).
// 내용은 정기 실행의 규칙과 같아야 한다: collector/tools/triage_review.py(인스타 글 나누기),
// collector/tools/publish_verified.py(공개 검증). 규칙을 바꾸면 여기도 함께 고친다.

import { Modal } from "@mantine/core";

type Item = { name: string; who: string; rule: string[]; todo: string; next: string };

const INSTA: Item[] = [
    {
        name: "공개 후보", who: "인스타그램 글",
        rule: ["기관 계정의 글이고 날짜와 장소가 모두 있음", "또는 작가·단체 계정이지만 «상시 동의» 계정이고 날짜가 있음", "또는 운영자가 다른 갈래에서 옮겨 온 글"],
        todo: "원문을 열어 보고 골라서 «공개 승인»", next: "다음 정기 실행이 날짜·원문 링크·중복을 확인한 뒤 공개. 걸리면 «검증 실패»로 남음",
    },
    {
        name: "동의 필요", who: "인스타그램 글",
        rule: ["작가·단체 계정의 글(상시 동의 계정이 아님)", "상시 동의 계정이어도 날짜를 읽지 못한 글"],
        todo: "게시 동의를 받고 계정의 동의 단계를 적음. 글 하나만이면 «공개 후보로 옮기기»", next: "«상시 동의»로 바꾸면 날짜 있는 글은 다음 정기 실행이 공개 후보로 옮김",
    },
    {
        name: "사람 판단", who: "인스타그램 글",
        rule: ["소식을 옮겨 싣는 계정(인플루언서)의 글", "날짜를 읽지 못한 글", "포스터 그림에만 정보가 있는 글", "기관 계정인데 장소를 읽지 못한 글", "계정 역할이 정해지지 않은 글"],
        todo: "원문을 보고 공개할 만하면 «공개 후보로 옮기기», 아니면 «반영 안 함»", next: "옮긴 글은 공개 후보에서 승인해야 공개됨",
    },
];

const WEB: Item = {
    name: "자동 공개 대기", who: "기관 누리집·블로그·KOPIS 수집분",
    rule: ["날짜 없음: 시작일·끝나는 날을 읽지 못함", "검증에서 멈춤: 날짜는 범위 안인데 원문 링크가 열리지 않거나 극장 영화로 걸러짐", "60일 뒤 행사: 시작일이 오늘부터 60일보다 뒤"],
    todo: "날짜 없음은 원문에서 날짜를 확인해 적음. 60일 뒤 행사는 할 일 없음", next: "다음 정기 실행이 다시 검증해 통과하면 공개",
};

function Card({ it }: { it: Item }) {
    return (
        <div className="rounded-[12px] bg-soft px-3.5 py-3">
            <p className="text-[15px] font-bold text-ink">{it.name} <span className="text-[12px] font-medium text-ink-soft">{it.who}</span></p>
            <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">여기 오는 기준</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[13.5px] leading-relaxed text-ink">{it.rule.map(r => <li key={r}>{r}</li>)}</ul>
            <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">운영자가 할 일</p>
            <p className="text-[13.5px] leading-relaxed text-ink">{it.todo}</p>
            <p className="mt-1.5 text-[12px] font-semibold text-ink-soft">그다음</p>
            <p className="text-[13.5px] leading-relaxed text-ink">{it.next}</p>
        </div>
    );
}

export function CriteriaModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
    return (
        <Modal opened={opened} onClose={onClose} size="xl" centered title={<span className="text-[16px] font-bold text-ink">판단 대기 기준</span>}>
            <p className="text-[13.5px] leading-relaxed text-ink">
                정기 실행(매일 08:20·15:00)이 수집한 글을 아래 순서로 나눕니다. 위에서부터 처음 맞는 규칙 하나만 적용합니다.
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13.5px] leading-relaxed text-ink">
                <li>끝나는 날(없으면 시작일)이 오늘보다 앞이면 <b>만료</b> — 판단 대기에 오지 않습니다.</li>
                <li>이미 공개된 행사와 같으면(시작일이 같고 제목이 서로 포함) <b>중복</b> — 판단 대기에 오지 않습니다.</li>
                <li>인스타그램 글은 계정 역할과 읽힌 정보에 따라 <b>공개 후보 · 동의 필요 · 사람 판단</b>으로 갑니다.</li>
                <li>기관 누리집·블로그·KOPIS 수집분은 날짜(오늘~60일)·원문 링크·중복 검증을 통과하면 <b>바로 공개</b>되고, 통과하지 못한 것만 <b>자동 공개 대기</b>에 남습니다.</li>
            </ol>

            <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                {INSTA.map(it => <Card key={it.name} it={it} />)}
                <Card it={WEB} />
            </div>

            <ul className="mt-3 list-disc space-y-1 pl-4 text-[12.5px] leading-relaxed text-ink-soft">
                <li>운영자가 한 번 옮긴 갈래는 정기 실행이 다시 바꾸지 않습니다(만료·중복만 다시 봅니다).</li>
                <li>이 화면에서는 어떤 글도 바로 공개되지 않습니다. 승인하거나 고친 것은 다음 정기 실행이 검증한 뒤 공개합니다.</li>
                <li>정기 실행의 링크 확인은 인스타그램 글이 지워졌는지는 가려내지 못합니다. 승인 전에 원문을 열어 보세요.</li>
                <li>«반영 안 함»은 지우지 않고 남겨 두어 같은 글이 다시 수집되지 않게 합니다. «반영 안 한 것»에서 되돌릴 수 있습니다.</li>
                <li>글마다 «자세히 · 코멘트»에서 판단이 왜 맞거나 틀렸는지 적어 두면, 분류 규칙을 손볼 때 근거로 씁니다.</li>
            </ul>
        </Modal>
    );
}
