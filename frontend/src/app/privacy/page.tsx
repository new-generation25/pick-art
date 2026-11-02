import type { Metadata } from "next";
import { LegalDoc, Section } from "@/components/ui/LegalDoc";

export const metadata: Metadata = {
    title: "개인정보처리방침 | 피카 pica",
    description: "피카(pica)가 어떤 개인정보를 왜 받고, 얼마나 보관하며, 어떻게 지우는지 알려 드립니다.",
    alternates: { canonical: "/privacy" },
};

const CONTACT = "pick.art.pica@gmail.com";

export default function PrivacyPage() {
    return (
        <LegalDoc title="개인정보처리방침" effective="2026-11-02">
            <p>
                피카(pica, 이하 &ldquo;서비스&rdquo;)는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고, 관련 고충을
                신속하게 처리하기 위해 이 처리방침을 둡니다.
            </p>

            <Section n={1} title="처리 목적">
                <ul>
                    <li>회원 식별과 로그인 유지</li>
                    <li>이용자가 고른 지역·관심 분야에 맞춘 행사 목록 제공</li>
                    <li>이용자가 신청한 뉴스레터와 키워드 알림 메일 발송</li>
                </ul>
                <p>위 목적 밖으로는 쓰지 않으며, 목적이 바뀌면 미리 알리고 동의를 받습니다.</p>
            </Section>

            <Section n={2} title="처리 항목">
                <table>
                    <thead>
                        <tr><th>구분</th><th>항목</th><th>받는 때</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>필수</td><td>이메일, 계정 식별자</td><td>구글 계정으로 로그인할 때 (인증 업체가 보관)</td></tr>
                        <tr><td>필수</td><td>닉네임, 지역, 관심 분야</td><td>가입 3단계 화면</td></tr>
                        <tr><td>설정</td><td>알림 설정, 내 지역 자동 적용</td><td>설정 화면에서 바꿀 때</td></tr>
                        <tr><td>선택</td><td>전화번호</td><td>설정 화면에 직접 적을 때만. 비워 둬도 모든 기능을 쓸 수 있습니다</td></tr>
                        <tr><td>신청 시</td><td>뉴스레터·키워드 이메일 (키워드 알림은 키워드 포함)</td><td>소식 받기 폼을 낼 때 (로그인 없이도 가능)</td></tr>
                    </tbody>
                </table>
                <p>구글이 넘겨주는 이름·프로필 사진은 서비스 화면과 데이터베이스에 쓰지 않습니다.</p>
            </Section>

            <Section n={3} title="보유·이용 기간">
                <ul>
                    <li>회원 정보: 회원 탈퇴를 요청할 때까지. 요청을 받으면 지체 없이 지웁니다.</li>
                    <li>뉴스레터·키워드 이메일: 수신 거부를 요청할 때까지.</li>
                    <li>법령이 보관을 요구하는 경우에는 그 기간 동안만 따로 보관합니다.</li>
                </ul>
            </Section>

            <Section n={4} title="파기 절차와 방법">
                <p>보유 기간이 끝나거나 처리 목적을 이루면 데이터베이스에서 해당 기록을 지워 다시 살릴 수 없게 합니다.</p>
            </Section>

            <Section n={5} title="제3자 제공">
                <p>이용자의 개인정보를 제3자에게 제공하지 않습니다. 법령에 근거가 있는 경우만 예외입니다.</p>
            </Section>

            <Section n={6} title="처리 위탁">
                <table>
                    <thead>
                        <tr><th>받는 곳</th><th>맡기는 일</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>Supabase Inc.</td><td>회원 인증, 데이터베이스와 파일 저장</td></tr>
                        <tr><td>Vercel Inc.</td><td>웹사이트 운영(호스팅)</td></tr>
                        <tr><td>Google LLC</td><td>구글 계정 로그인</td></tr>
                    </tbody>
                </table>
                <p>위 업체는 해외 사업자이며, 서비스 제공에 필요한 범위에서만 정보가 저장·처리됩니다.</p>
            </Section>

            <Section n={7} title="이용자의 권리와 행사 방법">
                <p>
                    이용자는 언제든지 자기 개인정보의 열람·정정·삭제·처리 정지를 요구할 수 있습니다. 닉네임·지역·관심 분야·전화번호·알림
                    설정은 설정 화면에서 직접 고칠 수 있고, 그 밖의 요청과 회원 탈퇴는 아래 메일로 보내 주시면 지체 없이 처리합니다.
                </p>
            </Section>

            <Section n={8} title="자동 수집 장치">
                <p>로그인 상태를 유지하기 위해 브라우저 저장소에 로그인 세션 정보를 보관합니다. 광고·행태 추적용 쿠키는 쓰지 않습니다.</p>
            </Section>

            <Section n={9} title="안전성 확보 조치">
                <ul>
                    <li>데이터베이스 행 단위 접근 제어: 이용자는 자기 정보만, 운영 권한은 지정된 계정만 접근</li>
                    <li>전송 구간 암호화(HTTPS)</li>
                    <li>관리용 비밀키는 코드 저장소에 넣지 않고 따로 보관</li>
                </ul>
            </Section>

            <Section n={10} title="개인정보 보호책임자">
                <p>
                    책임자: pica 운영자<br />
                    연락처: <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">{CONTACT}</a>
                </p>
                <p>
                    개인정보 침해에 대한 신고·상담은 개인정보침해신고센터(국번 없이 118), 개인정보분쟁조정위원회(1833-6972)에도 할 수 있습니다.
                </p>
            </Section>

            <Section n={11} title="변경 고지">
                <p>이 방침을 바꾸면 시행 7일 전부터 서비스 화면에 알립니다.</p>
                <ul>
                    <li>2026-11-02: 처음 제정</li>
                </ul>
            </Section>
        </LegalDoc>
    );
}
