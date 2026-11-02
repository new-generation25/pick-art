import { permanentRedirect } from "next/navigation";

// 가입은 소셜 로그인으로만 한다 (spec 001 US4). 예전 주소로 오면 로그인 화면으로 보낸다.
export default function SignupPage() {
    permanentRedirect("/login");
}
