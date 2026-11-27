import type { Metadata } from "next";
import Link from "next/link";
import { AgreementForm } from "@/components/partners/AgreementForm";

// 예술가·작은 단체 안내 + 정보 제공 동의(정식 협약) 받기 (specs/016).
// 운영자 11/26 «/partners를 예술가·작은 단체용으로 다듬고 끝에 동의 칸». 기관용 설명(KOPIS·공연법·통계)은 지우지 않고 맨 아래 접는 칸으로 옮겼다.
// 「지금」과 「준비 중」은 실제 기능 기준으로 적는다(헌장 I). 기능이 바뀌면 이 표시부터 고친다.
// 동의서 문구는 src/lib/partnerAgreement.ts 한곳에 있다(초안 표시·버전 포함).
export const metadata: Metadata = {
    title: "예술가·단체 안내 | 피카 pica",
    description: "내 공연·전시를 피카에 무료로 실어 드려요. 공식 SNS에 올리면 피카가 찾아 확인해 싣고, 한 번 동의해 주시면 묻지 않고 바로 실어요.",
    alternates: { canonical: "/partners" },
};

/** 카카오톡 채널 «피카» 채팅방 (specs/017). 챗봇이 동의를 받고 사진·글을 리플렛 검토함으로 넣는다. 11/26 운영자 휴대폰 시험 통과 → «지금» */
const KAKAO_CHAT = "https://pf.kakao.com/_xoxdxkvX/chat";

const NOW = "bg-[var(--pk-ink)] text-[var(--pk-paper)]";
const SOON = "border-[1.5px] border-[var(--pk-ink-soft)] text-ink-soft";

function Tag({ soon }: { soon?: boolean }) {
    return <span className={`ml-2 inline-block px-2 py-[1px] align-middle text-[12px] font-bold ${soon ? SOON : NOW}`}>{soon ? "준비 중" : "지금"}</span>;
}

function Box({ title, soon, cta, children }: { title: string; soon?: boolean; cta?: { href: string; label: string }; children: React.ReactNode }) {
    return (
        <div className="border-[1.5px] border-line bg-[var(--pk-card)] p-4">
            <h3 className="text-[16px] font-bold text-ink">{title}<Tag soon={soon} /></h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-ink">{children}</ul>
            {cta && <CtaLink href={cta.href} label={cta.label} />}
        </div>
    );
}

/** 바로 쓸 수 있는 기능으로 가는 버튼 (사이트 강조색) */
function CtaLink({ href, label, invert }: { href: string; label: string; invert?: boolean }) {
    const color = invert
        ? "border-[1.5px] border-[var(--pk-ink)] bg-[var(--pk-card)] text-ink"
        : "bg-[var(--pk-accent)] text-[var(--pk-on-accent)]";
    return (
        <Link href={href} className={`mt-3 inline-flex min-h-12 items-center px-4 text-[15px] font-bold no-underline ${color}`}>
            {label} →
        </Link>
    );
}

/** «이렇게 실려요» 예시 칸. 실제 사이트 카드와 같은 모양, 이름은 가렸다(동의받은 단체 예시가 생기면 바꾼다) */
function SampleTile({ date, title, label, venue }: { date: string; title: string; label: string; venue: string }) {
    return (
        <div className="w-[132px] flex-none text-ink">
            <div className="pica-poster" data-size="shelf">
                <div className="pica-textposter">
                    <span className="tp-date">{date}</span>
                    <span className="tp-title pica-clamp-3">{title}</span>
                    <span className="tp-src">정보: 단체 인스타그램</span>
                </div>
            </div>
            <p className="mt-2 text-[12px] font-bold text-accent">{label}</p>
            <p className="mt-0.5 text-[14px] font-bold leading-[1.3]">{title}</p>
            <p className="mt-0.5 text-[12px] text-ink-soft">{venue}</p>
        </div>
    );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="pica-num flex h-8 w-8 flex-none items-center justify-center bg-[var(--pk-ink)] text-[15px] font-bold text-[var(--pk-paper)]">{n}</span>
            <div className="text-[15px] leading-relaxed text-ink"><b className="block text-[16px]">{title}</b>{children}</div>
        </li>
    );
}

export default function PartnersPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-2xl space-y-12 px-4 pt-20 sm:px-6 sm:pt-24">
                <header>
                    <p className="text-[13px] font-bold tracking-wide text-ink-soft">pica · 예술가·작은 단체께</p>
                    <h1 className="pica-display mt-2 text-[30px] leading-[1.25] text-ink sm:text-[40px]">내 공연·전시, 피카에 무료로 실어 드려요</h1>
                    <p className="mt-4 text-[16px] leading-relaxed text-ink">
                        피카는 부산과 김해·창원·진주 같은 동네의 공연·전시를 날짜순으로 모아 보여 주는 곳이에요.
                        소극장, 작은 극단, 동네 갤러리 행사도 큰 기관 행사와 같은 크기로 실어요.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3">
                        <CtaLink href="#join" label="동의하고 파트너십 맺기" />
                        <CtaLink href="/tip/leaflet" label="리플렛 한 장으로 알리기" invert />
                    </div>
                </header>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">이렇게 실려요</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink">날짜가 먼저 보이고, 누르면 원본 공지·예매 링크로 이어져요.</p>
                    <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
                        <SampleTile date="12.5–12.7" title="연극 〈○○○○〉" label="공연 · 연극" venue="김해 ○○소극장" />
                        <SampleTile date="12.10–12.21" title="○○○ 개인전" label="전시 · 회화·드로잉" venue="창원 ○○갤러리" />
                        <div className="w-[200px] flex-none border-[1.5px] border-line bg-[var(--pk-card)] p-3 text-ink">
                            <p className="text-[12px] text-ink-soft">단체 페이지</p>
                            <p className="mt-1 text-[17px] font-bold">극단 ○○</p>
                            <span className="mt-1 inline-block border-[1.5px] border-[var(--pk-accent)] px-1.5 text-[12px] font-bold text-accent">협약</span>
                            <p className="mt-2 text-[13px] leading-relaxed">다가오는 행사 2 · 지난 행사 5</p>
                            <p className="text-[13px] leading-relaxed">이 단체 일정만 캘린더로 구독</p>
                        </div>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-soft">예시예요. 실제 단체 이름은 가렸어요.</p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">하실 일은 이 정도예요</h2>
                    <ol className="mt-4 flex flex-col gap-4">
                        <Step n={1} title="평소처럼 공식 SNS에 올리세요">
                            피카가 기관 누리집·단체 인스타그램 300여 곳을 살펴, 공지가 올라오면 찾아 확인한 뒤 실어요.
                        </Step>
                        <Step n={2} title="한 번 동의해 주세요">
                            <Link href="#join" className="font-bold underline underline-offset-2">아래 동의 칸</Link>에 세 칸만 적으면 돼요. 그다음부터는 공지마다 묻지 않고 바로 실어요.
                        </Step>
                        <Step n={3} title="빠진 게 있으면 알려 주세요">
                            <Link href="/tip/leaflet" className="font-bold underline underline-offset-2">리플렛 사진 한 장</Link>이나 <Link href="/tip" className="font-bold underline underline-offset-2">행사 제보</Link>로 보내 주세요.
                            카카오톡 채널 <a href={KAKAO_CHAT} className="font-bold underline underline-offset-2">«피카»</a>에서 «행사 알리기»를 눌러 보내셔도 돼요.
                        </Step>
                    </ol>
                    <p className="mt-4 text-[14px] leading-relaxed text-ink-soft">관객·출연자 개인 연락처, 잔여석, 매출은 받지 않아요. 정기 회의나 보고도 없어요.</p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">실리면 생기는 것</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Box title="무료로 실려요">
                            <li>날짜·장소·요금·예매 방법을 원본 링크와 함께(네이버 폼·계좌 안내도 그대로)</li>
                            <li>«내 주변» 거리순·지도, 네이버 지도 길찾기</li>
                            <li>관객의 즐겨찾기, 내 캘린더에 넣기</li>
                            <li>틀린 곳은 알려 주시면 원본과 맞춰 고쳐요</li>
                        </Box>
                        <Box title="단체·공간 페이지">
                            <li>다가오는 행사와 지난 행사를 한 페이지에</li>
                            <li>그 단체 일정만 캘린더로 구독</li>
                            <li>행사 상세에 «주최·주관»으로 연결</li>
                        </Box>
                        <Box title="리플렛 사진 한 장으로 등록" cta={{ href: "/tip/leaflet", label: "사진 한 장으로 등록하기" }}>
                            <li>리플렛·포스터를 올리면 피카가 글자를 읽어 정리해요</li>
                            <li>운영자 확인 뒤 실려요. 공식 페이지가 없으면 «단체 제공»으로 표시해요</li>
                            <li>로그인이 필요하고 하루 5장까지예요</li>
                        </Box>
                        <Box title="카카오톡으로 보내기" cta={{ href: KAKAO_CHAT, label: "카카오톡 채널 «피카» 열기" }}>
                            <li>채널 «피카»(검색 ID pickanews) 채팅방에서 «행사 알리기»를 누르고 리플렛·포스터 사진을 보내 주세요</li>
                            <li>처음 한 번 권리 확인 두 가지에 동의하면 돼요. 로그인은 필요 없어요</li>
                            <li>단체 이름·날짜는 사진 바로 뒤에 글로 보내도 같이 묶여요</li>
                            <li>운영자 확인 뒤 실리고, 하루 5건까지예요. 받은 사진은 포스터로 쓰지 않아요(포스터로 실리려면 사이트에서 파일로 올려 주세요)</li>
                        </Box>
                        <Box title="노출·클릭 정리">
                            <li>피카에서 몇 번 보였고, 원본 안내·캘린더 추가가 몇 번 눌렸는지 달마다 정리돼요</li>
                            <li>지금은 메일로 요청하시면 보내 드려요. 직접 보는 화면은 준비 중이에요</li>
                            <li>예매·관람 수는 알 수 없어요</li>
                        </Box>
                        <Box title="예매·결제 대행" soon>
                            <li>계좌이체·네이버 폼으로 표를 파는 단체도 관객이 카드·간편결제로 바로 예매하게 해요</li>
                            <li>입금 확인·명단 정리를 피카가 하고, 판매 대금은 공연 뒤 정산해요</li>
                            <li>전산으로 판 표는 공연법에 따라 KOPIS로 보내야 하는데, 이것도 피카가 맡아요</li>
                            <li>수수료와 정산 날짜는 정해지면 여기에 먼저 알려 드릴게요</li>
                        </Box>
                        <Box title="맞춤 지원사업 알림" soon>
                            <li>단체 조건(지역·장르·고유번호·활동 연수)에 맞을 수 있는 공고만, 마감 2주 전에</li>
                            <li>참고용이에요. 신청 전에 공고 원문의 자격을 꼭 확인해 주세요</li>
                        </Box>
                    </div>
                </section>

                <section className="space-y-2 border-l-4 border-[var(--pk-accent)] py-1 pl-4">
                    <h2 className="pica-display text-[24px] leading-tight text-ink">피카가 지키는 약속</h2>
                    <p className="text-[15px] leading-relaxed text-ink"><b>공연 정보는 단체의 것이에요.</b> 요청하시면 7일 안에 내려요.</p>
                    <p className="text-[15px] leading-relaxed text-ink"><b>돈을 낸 단체가 위에 뜨지 않아요.</b> 목록은 날짜·지역 규칙으로만 정렬해요. 광고가 생겨도 «광고» 표시를 단 따로 된 자리에만 둬요.</p>
                    <p className="text-[15px] leading-relaxed text-ink"><b>연락처는 공개하지 않아요.</b> 연락에만 써요.</p>
                    <p className="text-[15px] leading-relaxed text-ink"><b>확인한 정보만 실어요.</b> 날짜가 없거나 확인이 안 되면 먼저 물어봐요.</p>
                    <p className="text-[15px] leading-relaxed text-ink"><b>단체 개별 정보를 팔지 않아요.</b> 지역·장르별 건수 같은 비식별 통계만 공공에 제공할 수 있어요.</p>
                </section>

                <section id="join" className="scroll-mt-20">
                    <h2 className="pica-display text-[26px] leading-tight text-ink">동의하고 파트너십 맺기</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-ink">
                        한 번 동의해 주시면 그다음 공지부터는 묻지 않고 바로 실어요. 무료이고, 언제든 그만둘 수 있어요.
                    </p>
                    <div className="mt-5">
                        <AgreementForm />
                    </div>
                    <p className="mt-4 text-[14px] text-ink-soft">메일로 보내셔도 돼요: <span className="select-all font-mono font-bold text-ink">pick.art.pica@gmail.com</span></p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">자주 묻는 것</h2>
                    <div className="mt-3 divide-y divide-[var(--pk-line)] border-y border-line text-[15px] leading-relaxed">
                        {[
                            ["돈이 드나요?", "게재, 정정, 단체·공간 페이지, 리플렛 등록, 노출·클릭 정리는 모두 무료예요. 준비 중인 예매·결제 대행만 결제 수수료가 생길 수 있고, 정해지면 미리 알려 드려요."],
                            ["동의 안 하면 안 실리나요?", "공식 SNS에 공개한 공지는 확인한 뒤 실을 수 있어요. 다만 작은 단체·개인 계정은 먼저 여쭙고 실어요. 동의해 두시면 묻는 단계 없이 바로 실려요."],
                            ["홍보물도 만들어 주나요?", "피카는 홍보물을 만들지 않아요. 맡길 곳을 묻는 단체를 위해 추천 업체 목록을 준비하고 있어요(준비 중). 소개 수수료는 받지 않아요."],
                            ["예매·결제도 맡길 수 있나요?", "준비하고 있어요. 수수료와 정산 날짜가 정해지면 이 페이지에 먼저 알려 드릴게요. 미리 써 보고 싶으면 메일로 알려 주세요."],
                            ["이미 KOPIS에 올리는데 따로 알려야 하나요?", "KOPIS에 올린 공연은 피카가 자동으로 받아요. 전시나 무료 공연처럼 KOPIS에 안 들어가는 행사는 리플렛이나 제보로 알려 주세요."],
                            ["사진·포스터는 어떻게 쓰나요?", "허락한 범위에서 피카 사이트와 인스타그램 @picka.news 소개에만 써요. 휴대폰으로 찍은 사진은 포스터로 쓰지 않아요."],
                            ["내리고 싶으면요?", "메일 한 통이나, 로그인해서 보낸 신청이면 위 «내가 보낸 신청»의 «철회 요청»으로요. 7일 안에 단체 정보를 내려요."],
                        ].map(([q, a]) => (
                            <details key={q} className="py-3">
                                <summary className="min-h-8 cursor-pointer font-bold text-ink">{q}</summary>
                                <p className="mt-2 text-ink">{a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <details className="border-[1.5px] border-line bg-[var(--pk-card)] px-4 py-3">
                    <summary className="min-h-8 cursor-pointer text-[16px] font-bold text-ink">기관·공공 담당자께: 공공 데이터에 안 잡히는 공연</summary>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink">
                        공연 정보는 공연예술통합전산망(KOPIS)에 모이는데, 공연법은 <b>전산 예매 시스템으로 표를 팔지 않는 공연</b>을 전송 의무에서 빼요.
                        네이버 폼으로 예약받고 계좌이체로 파는 공연, 현장에서만 파는 공연은 공공 데이터에 없어요. 전시는 KOPIS 대상이 아니에요.
                    </p>
                    <p className="mt-4"><span className="pica-display text-[44px] leading-none text-accent">395</span><span className="ml-1 text-[15px] text-ink">/ 722건</span></p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                        2026-11-25에 피카에 올라 있던 부산과 창원·김해·진주 등 18개 시군의 진행·예정 행사 722건 가운데,
                        공공 데이터 중심 서비스에는 없던 행사가 395건이었어요. 대부분 기관 누리집과 단체 인스타그램에서 직접 찾은 것이에요.
                    </p>
                </details>

                <p className="text-[13px] text-ink-soft">
                    숫자는 2026-11-25 기준이에요. 일반 이용자를 위한 소개는 <Link href="/about" className="underline underline-offset-2">피카 소개</Link>에 있어요.
                </p>
            </div>
        </main>
    );
}
