import { redirect } from "next/navigation";

// 찜한 행사는 «내 정보»(/me) 한 화면으로 옮겼다 (specs/014 US6). 예전 주소·북마크는 그 칸으로 보낸다
export default function SavedPage() {
    redirect("/me#saved");
}
