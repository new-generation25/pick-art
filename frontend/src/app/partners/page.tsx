import type { Metadata } from "next";
import Link from "next/link";

// 단체·공간 안내. 초안 docs/partner/page_partners.html(11/26)을 사이트 틀로 옮긴 것.
// 「지금」과 「준비 중」은 실제 기능 기준으로 적는다(헌장 I). 기능이 바뀌면 이 표시부터 고친다.
export const metadata: Metadata = {
    title: "단체·공간 안내 | 피카 pica",
    description: "공연·전시 정보를 보내 주시면 날짜와 원본 링크 그대로 무료로 실어 드려요. 소극장·작은 극단·동네 갤러리 행사도 같은 크기로 보여 드려요.",
    alternates: { canonical: "/partners" },
};

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
        ? "bg-[var(--pk-paper)] text-ink"
        : "bg-[var(--pk-accent)] text-[var(--pk-on-accent)]";
    return (
        <Link href={href} className={`mt-3 inline-block px-4 py-2.5 text-[15px] font-bold no-underline ${color}`}>
            {label} →
        </Link>
    );
}

export default function PartnersPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-2xl space-y-12 px-4 pt-20 sm:px-6 sm:pt-24">
                <header>
                    <p className="text-[13px] font-bold tracking-wide text-ink-soft">pica · 단체·공간 안내</p>
                    <h1 className="pica-display mt-2 text-[32px] leading-[1.2] text-ink sm:text-[40px]">공연·전시 정보를 보내 주시면, 날짜와 원본 링크 그대로 실어 드려요</h1>
                    <p className="mt-4 text-[16px] leading-relaxed text-ink">
                        피카는 가까운 공연·전시·축제를 공식 출처로 확인해 날짜순으로 알려 주는 서비스예요.
                        소극장, 작은 극단, 동네 갤러리 행사도 큰 기관 행사와 같은 크기로 보여 드려요. 실어 드리는 데 돈은 받지 않아요.
                    </p>
                    <CtaLink href="/tip/leaflet" label="리플렛 사진 한 장으로 등록하기" />
                </header>

                <section className="border-2 border-[var(--pk-ink)] bg-[var(--pk-card)] p-5">
                    <h2 className="pica-display text-[24px] leading-tight text-ink">공공 데이터에 안 잡히는 공연이 있어요</h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink">
                        공연 정보는 공연예술통합전산망(KOPIS)에 모이는데, 공연법은 <b>전산 예매 시스템으로 표를 팔지 않는 공연</b>을 전송 의무에서 빼요.
                        네이버 폼으로 예약받고 계좌이체로 파는 공연, 현장에서만 파는 공연은 공공 데이터에 없어요. 전시는 KOPIS 대상이 아니에요.
                    </p>
                    <p className="mt-4"><span className="pica-display text-[44px] leading-none text-accent">395</span><span className="ml-1 text-[15px] text-ink">/ 722건</span></p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                        2026-11-25에 피카에 올라 있던 부산과 창원·김해·진주 등 18개 시군의 진행·예정 행사 722건 가운데,
                        공공 데이터 중심 서비스에는 없던 행사가 395건이었어요. 대부분 기관 누리집과 단체 인스타그램에서 직접 찾은 것이에요.
                    </p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">피카에 실리면 이렇게 돼요</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Box title="무료로 실려요">
                            <li>날짜·장소·요금·예매 방법을 원본 링크와 함께 게재(네이버 폼·계좌 안내 링크도 그대로)</li>
                            <li>「내 주변」 거리순·지도 보기, 네이버 지도 길찾기</li>
                            <li>관객의 즐겨찾기, 내 캘린더에 넣기</li>
                            <li>틀린 곳은 알려 주시면 원본과 맞춰 고쳐요</li>
                        </Box>
                        <Box title="단체·공간 페이지">
                            <li>단체·공간별로 다가오는 행사와 지난 행사를 한 페이지에</li>
                            <li>그 단체·공간 일정만 캘린더로 구독</li>
                            <li>행사 상세에 「주최·주관」으로 연결</li>
                        </Box>
                        <Box title="리플렛 사진 한 장으로 등록" cta={{ href: "/tip/leaflet", label: "사진 한 장으로 등록하기" }}>
                            <li>리플렛·포스터 파일이나 휴대폰 사진을 올리면 피카가 글자를 읽어 정리해요</li>
                            <li>운영자가 확인한 뒤 실려요. 공식 페이지가 없으면 「단체 제공」으로 표시해요</li>
                            <li>로그인이 필요하고 하루 5장까지 올릴 수 있어요</li>
                        </Box>
                        <Box title="노출·클릭 정리">
                            <li>우리 행사가 피카에서 몇 번 보였고, 원본 안내·캘린더 추가가 몇 번 눌렸는지 달마다 정리돼요</li>
                            <li>지금은 메일로 요청하시면 보내 드려요. 단체가 직접 받아 보는 화면은 준비 중이에요</li>
                            <li>예매·관람 수는 알 수 없어요. 노출과 클릭만 드려요</li>
                        </Box>
                        <Box title="예매·결제 대행" soon>
                            <li>계좌이체·네이버 폼·현장 판매로 표를 파는 단체를 위해, 관객이 피카에서 카드·간편결제로 바로 예매하게 해요</li>
                            <li>입금 확인·명단 정리를 피카가 대신하고, 판매 대금은 공연이 끝난 뒤 단체에 정산해요</li>
                            <li>전산으로 판 표는 공연법에 따라 공연예술통합전산망(KOPIS)에 보내야 해요. 이 전송도 피카가 맡아요</li>
                            <li>수수료와 정산 날짜는 정해지면 이 페이지에 먼저 알려 드릴게요</li>
                        </Box>
                        <Box title="맞춤 지원사업 알림" soon>
                            <li>단체 조건(지역·장르·고유번호 유무·활동 연수 등)에 맞을 수 있는 공고만</li>
                            <li>마감 2주 전에 알려 드려요</li>
                            <li>참고용이에요. 신청 전에 공고 원문의 자격 요건을 꼭 확인해 주세요</li>
                        </Box>
                    </div>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">단체가 하실 일은 이 정도예요</h2>
                    <dl className="mt-4 divide-y divide-[var(--pk-line)] border-y border-line text-[15px] leading-relaxed">
                        <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="font-bold text-ink-soft">아무것도 안 해도</dt><dd className="text-ink">피카가 살피는 기관 누리집·단체 인스타그램(300여 곳)에 공지가 올라오면 자동으로 찾아 확인한 뒤 실어요. 우리 단체 계정이 빠져 있다면 알려 주세요.</dd></div>
                        <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="font-bold text-ink-soft">사진 한 장으로</dt><dd className="text-ink"><Link href="/tip/leaflet" className="font-bold underline underline-offset-2">리플렛으로 알리기</Link>에서 리플렛·포스터를 올려 주세요.</dd></div>
                        <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="font-bold text-ink-soft">글로 알리기</dt><dd className="text-ink"><Link href="/tip" className="font-bold underline underline-offset-2">행사 제보하기</Link>에 날짜·장소·공식 안내 주소를 적어 주세요.</dd></div>
                        <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]"><dt className="font-bold text-ink-soft">받지 않는 것</dt><dd className="text-ink">관객·출연자 개인 연락처, 잔여석 실시간 정보, 매출. 정기 회의나 보고도 요청하지 않아요.</dd></div>
                    </dl>
                </section>

                <section className="space-y-3 border-l-4 border-[var(--pk-accent)] py-1 pl-4">
                    <h2 className="pica-display text-[24px] leading-tight text-ink">피카가 지키는 약속</h2>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">공연 정보는 단체의 것이에요. 요청하시면 7일 안에 내려요.</p>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">단체 개별 정보를 팔지 않아요. 공개된 정보를 바탕으로 한 비식별 통계(지역·장르별 건수 같은 것)만 공공에 제공할 수 있어요.</p>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">돈을 낸 단체가 위에 뜨지 않아요. 목록은 날짜·지역 규칙으로만 정렬해요. 앞으로 광고가 생겨도 「광고」 표시를 단 따로 된 자리에만 두고, 일반 목록 순서에는 영향을 주지 않아요.</p>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">확인한 정보만 실어요. 날짜가 없거나 확인이 안 되면 싣지 않고 먼저 물어봐요.</p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">자주 묻는 것</h2>
                    <div className="mt-3 divide-y divide-[var(--pk-line)] border-y border-line text-[15px] leading-relaxed">
                        {[
                            ["돈이 드나요?", "게재, 정정, 단체·공간 페이지, 리플렛 등록, 노출·클릭 정리는 모두 무료예요. 준비 중인 예매·결제 대행만 결제 수수료가 생길 수 있고, 정해지면 미리 알려 드려요."],
                            ["홍보물도 만들어 주나요?", "피카는 홍보물을 만들지 않아요. 맡길 곳을 묻는 단체를 위해 추천 업체 목록을 준비하고 있어요(준비 중). 피카는 소개 수수료를 받지 않고, 계약과 품질은 단체와 업체가 직접 정해요."],
                            ["예매·결제도 맡길 수 있나요?", "준비하고 있어요. 계좌이체나 네이버 폼으로 표를 파는 단체가 카드·간편결제로 받을 수 있게, 피카가 결제를 받고 공연 뒤에 정산하는 방식이에요. 수수료와 정산 날짜가 정해지면 이 페이지에 먼저 알려 드릴게요. 미리 써 보고 싶은 단체는 메일로 알려 주세요."],
                            ["이미 KOPIS에 올리는데 따로 알려야 하나요?", "KOPIS에 올린 공연은 피카가 자동으로 받아요. 전시나 무료 공연처럼 KOPIS에 안 들어가는 행사는 리플렛이나 제보로 알려 주세요."],
                            ["사진·포스터는 어떻게 쓰나요?", "단체가 허락한 범위에서 피카 사이트와 인스타그램 @picka.news 소개에만 써요. 휴대폰으로 찍은 사진은 포스터로 쓰지 않아요."],
                            ["내리고 싶으면요?", "메일 한 통이면 돼요. 7일 안에 단체 정보를 내려요."],
                        ].map(([q, a]) => (
                            <details key={q} className="py-3">
                                <summary className="cursor-pointer font-bold text-ink">{q}</summary>
                                <p className="mt-2 text-ink">{a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="bg-[var(--pk-accent)] p-5 text-[var(--pk-on-accent)]">
                    <h2 className="pica-display text-[24px] leading-tight">함께하기</h2>
                    <p className="mt-2 text-[15px] leading-relaxed">
                        정보 제공 협약(동의서 한 장)을 맺고 싶으시면 단체 이름, 활동 지역, 공식 SNS 또는 누리집 주소를 메일로 보내 주세요. 신청 양식은 준비 중이에요.
                    </p>
                    <p className="mt-3 select-all font-mono text-[15px] font-bold">pick.art.pica@gmail.com</p>
                    <CtaLink href="/tip/leaflet" label="지금 리플렛 사진으로 등록하기" invert />
                </section>

                <p className="text-[13px] text-ink-soft">
                    숫자는 2026-11-25 기준이에요. 일반 이용자를 위한 소개는 <Link href="/about" className="underline underline-offset-2">피카 소개</Link>에 있어요.
                </p>
            </div>
        </main>
    );
}
