import type { Metadata } from "next";
import Link from "next/link";

// 피카 소개(일반 이용자). 초안 docs/partner/page_about.html(11/26)을 사이트 틀로 옮긴 것.
// 숫자는 적은 날짜를 함께 쓴다. 기능이 바뀌면 이 페이지부터 고친다(헌장 I).
export const metadata: Metadata = {
    title: "피카 소개 | 피카 pica",
    description: "가까운 공연·전시·축제를 공식 출처로 확인해 날짜순으로 알려 드려요. 큰 공연장부터 동네 소극장·서점 갤러리까지 같은 크기로.",
    alternates: { canonical: "/about" },
};

function Num({ n, label }: { n: string; label: string }) {
    return (
        <div className="border-2 border-[var(--pk-ink)] bg-[var(--pk-card)] px-4 py-3">
            <b className="pica-display block text-[34px] leading-tight text-ink">{n}</b>
            <span className="text-[13px] text-ink-soft">{label}</span>
        </div>
    );
}

export default function AboutPage() {
    return (
        <main className="min-h-screen pb-20">
            <div className="mx-auto max-w-2xl space-y-12 px-4 pt-20 sm:px-6 sm:pt-24">
                <header>
                    <p className="text-[13px] font-bold tracking-wide text-ink-soft">pica · 피카 소개</p>
                    <h1 className="pica-display mt-2 text-[40px] leading-[1.1] text-ink sm:text-[52px]">이번 주, 어디 가지?</h1>
                    <p className="mt-4 text-[16px] leading-relaxed text-ink">
                        피카는 가까운 공연·전시·축제를 공식 출처로 확인해서 날짜순으로 알려 줘요.
                        큰 공연장 공연부터 동네 소극장, 서점 갤러리 전시까지 같은 크기로 보여 줘요. 피카는 픽아트(pick-art)의 준말이에요.
                    </p>
                </header>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">지금 실려 있는 것</h2>
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                        <Num n="698" label="진행·예정 행사" />
                        <Num n="125" label="그중 전시" />
                        <Num n="19" label="부산과 18개 시군" />
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">2026-11-26 기준. 부산, 창원, 김해, 진주, 통영, 거제, 양산, 밀양 등. 숫자는 매일 바뀌어요.</p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">이렇게 골라요</h2>
                    <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink">
                        <li className="grid grid-cols-[32px_1fr]"><span className="pica-display text-[26px] leading-none text-accent">1</span><span><b>날짜가 있어야 실어요.</b> 시작일과 종료일을 확인 못 한 행사는 싣지 않아요.</span></li>
                        <li className="grid grid-cols-[32px_1fr]"><span className="pica-display text-[26px] leading-none text-accent">2</span><span><b>출처를 확인해요.</b> 주최 측 공지·예매 페이지 링크를 달고 열리는지 봐요. 공식 페이지가 없는 작은 행사는 단체가 보낸 리플렛을 운영자가 확인하고 「단체 제공」으로 표시해요.</span></li>
                        <li className="grid grid-cols-[32px_1fr]"><span className="pica-display text-[26px] leading-none text-accent">3</span><span><b>같은 행사를 두 번 싣지 않아요.</b> 여러 곳에 올라온 같은 공연은 하나로 합쳐요.</span></li>
                    </ol>
                    <p className="mt-4 text-[15px] leading-relaxed text-ink">
                        정보는 공연예술통합전산망(KOPIS), 문화재단·공연장·미술관 누리집, 단체와 공간의 공식 인스타그램, 단체가 보낸 리플렛에서 가져와요.
                        공공 데이터에 안 잡히는 작은 공연과 전시를 함께 찾는 게 피카가 하는 일이에요.
                    </p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">이렇게 써요</h2>
                    <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink">
                        <li>날짜순 목록에서 지역·분야 고르기, 「곧 끝남」만 보기</li>
                        <li><Link href="/nearby" className="font-bold underline underline-offset-2">내 주변</Link>: 가까운 순·지도로 보기, 네이버 지도 길찾기</li>
                        <li>행사마다 원본 링크와 예매 방법, 주최·주관과 공간 페이지</li>
                        <li>즐겨찾기, 내 캘린더에 넣기, <Link href="/calendar" className="font-bold underline underline-offset-2">캘린더로 받아 보기</Link></li>
                        <li>휴대폰 홈 화면에 앱처럼 설치</li>
                        <li>회원: 내 지역·관심 분야 먼저 보기, 소식 메일</li>
                    </ul>
                </section>

                <section className="space-y-3 border-l-4 border-[var(--pk-accent)] py-1 pl-4">
                    <h2 className="pica-display text-[24px] leading-tight text-ink">피카가 지키는 것</h2>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">돈을 받고 순서를 바꾸지 않아요. 목록은 날짜와 지역 규칙으로만 정렬해요.</p>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">광고나 제휴가 생기면 「광고」·「제휴」라고 분명히 표시해요.</p>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">방문과 클릭은 날짜별 숫자로만 세요. 누가 무엇을 봤는지는 기록하지 않아요.</p>
                    <p className="text-[15px] font-bold leading-relaxed text-ink">확인 못 한 건 말하지 않아요. 요금이 공지에 없으면 「문의 필요」라고 적어요.</p>
                </section>

                <section>
                    <h2 className="pica-display text-[24px] leading-tight text-ink">틀린 정보를 봤거나, 빠진 행사를 알면</h2>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink">
                        행사 상세의 오류 신고 버튼으로 알려 주세요. 피카에 없는 행사는 <Link href="/tip" className="font-bold underline underline-offset-2">행사 제보하기</Link>로 보내 주세요.
                        확인하고 고칠게요. 메일 <span className="select-all font-mono">pick.art.pica@gmail.com</span>이나 인스타그램 @picka.news 메시지도 받아요.
                    </p>
                </section>

                <p className="text-[13px] text-ink-soft">
                    공연·전시를 여는 단체라면 <Link href="/partners" className="underline underline-offset-2">단체·공간 안내</Link>를 봐 주세요.
                </p>
            </div>
        </main>
    );
}
