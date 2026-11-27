import { AdminShell } from "@/components/admin/AdminShell";

// 관리자 틀(메뉴 다섯·휴대폰 아래 탭·관리자 확인)은 AdminShell 이 맡는다 (specs/019 A1)
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return <AdminShell>{children}</AdminShell>;
}
