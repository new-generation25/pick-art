import Link from "next/link";

/** 로그인·가입 화면의 동의 안내 */
export function LegalLinks() {
    return (
        <p className="text-center text-[12px] leading-relaxed text-neutral-500">
            계속하면{" "}
            <Link href="/terms" className="underline underline-offset-2">이용약관</Link>과{" "}
            <Link href="/privacy" className="underline underline-offset-2">개인정보처리방침</Link>에 동의하는 것으로 봅니다.
        </p>
    );
}
