import { redirect } from "next/navigation";

// 내 지역·관심 분야·알림 설정은 «내 정보»(/me) 한 화면으로 옮겼다 (specs/014 US6). 예전 주소·북마크는 그 칸으로 보낸다
export default function SettingsPage() {
    redirect("/me#settings");
}
