import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, Section } from "@/components/ui/LegalDoc";

export const metadata: Metadata = {
    title: "이용약관 | 피카 pica",
    description: "피카(pica) 서비스를 이용할 때의 조건과 절차를 정합니다.",
    alternates: { canonical: "/terms" },
};

export default function TermsPage() {
    return (
        <LegalDoc title="이용약관" effective="2026-11-02">
            <Section n={1} title="목적">
                <p>이 약관은 피카(pica, 이하 &ldquo;서비스&rdquo;)를 이용하는 조건과 절차, 운영자와 이용자의 권리·의무를 정합니다.</p>
            </Section>

            <Section n={2} title="정의">
                <ul>
                    <li>&ldquo;서비스&rdquo;: 가까운 공연·전시·축제 등 문화 행사 정보를 모아 보여 주는 웹사이트와 관련 소식 발송</li>
                    <li>&ldquo;이용자&rdquo;: 서비스에 접속해 이용하는 사람. 로그인한 이용자를 &ldquo;회원&rdquo;이라 합니다</li>
                </ul>
            </Section>

            <Section n={3} title="회원가입">
                <p>
                    회원가입은 소셜 계정(구글·카카오) 로그인으로 합니다. 로그인하면 이 약관과{" "}
                    <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>에 동의한 것으로 봅니다.
                    회원은 언제든지 탈퇴를 요청할 수 있습니다.
                </p>
            </Section>

            <Section n={4} title="서비스 내용">
                <ul>
                    <li>공식 출처(기관 누리집, 공연 정보 공개 자료, 단체 계정 등)에서 확인한 행사 정보를 날짜순으로 정리해 보여 줍니다.</li>
                    <li>행사 정보는 각 원문 링크를 기준으로 합니다. 일정·장소·요금은 주최 측 사정으로 바뀔 수 있으니 방문 전 원문을 확인해 주세요.</li>
                    <li>회원이 고른 지역·관심 분야에 맞춘 목록, 뉴스레터, 키워드 알림을 제공합니다.</li>
                </ul>
            </Section>

            <Section n={5} title="이용자의 의무">
                <ul>
                    <li>다른 사람의 정보를 도용하거나 서비스 운영을 방해해서는 안 됩니다.</li>
                    <li>서비스의 정보를 자동화된 방법으로 대량 수집하거나 상업적으로 재배포해서는 안 됩니다.</li>
                </ul>
            </Section>

            <Section n={6} title="게시물">
                <p>
                    앞으로 제보·후기 등 이용자가 글을 올리는 기능이 생기면, 게시물의 권리는 작성자에게 있습니다. 서비스는 그 게시물을
                    서비스 화면과 소식 안내에 보여 줄 수 있으며, 법령을 어기거나 다른 사람의 권리를 침해하는 게시물은 내릴 수 있습니다.
                </p>
            </Section>

            <Section n={7} title="서비스 변경과 중단">
                <p>서비스 내용은 운영 사정에 따라 바뀌거나 중단될 수 있습니다. 중요한 변경은 미리 서비스 화면에 알립니다.</p>
            </Section>

            <Section n={8} title="책임의 제한">
                <p>
                    서비스는 무료로 제공되며, 행사 자체의 진행·취소·변경과 주최 측이 제공한 정보의 정확성에 대해서는 책임지지 않습니다.
                    다만 운영자의 고의나 중대한 과실로 생긴 손해는 예외로 합니다.
                </p>
            </Section>

            <Section n={9} title="분쟁 해결">
                <p>
                    서비스 이용과 관련한 문의·불만은{" "}
                    <a href="mailto:pick.art.pica@gmail.com" className="underline underline-offset-2">pick.art.pica@gmail.com</a>으로
                    보내 주세요. 분쟁은 대한민국 법을 따르며, 관할 법원은 민사소송법에 따릅니다.
                </p>
            </Section>

            <Section n={10} title="약관 변경">
                <p>약관을 바꾸면 시행 7일 전부터 서비스 화면에 알립니다.</p>
                <ul>
                    <li>2026-11-02: 처음 제정</li>
                </ul>
            </Section>
        </LegalDoc>
    );
}
