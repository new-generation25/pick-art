import { supabase } from "@/lib/supabase";

let leaving = false;
/** 로그아웃 버튼을 눌러 홈으로 가는 중인가 (관리자 화면이 같은 신호를 듣고 로그인 화면으로 보내지 않게) */
export const isLoggingOut = () => leaving;

/**
 * 로그아웃하고 홈을 새로 불러온다 (운영자 2026-11-27 «로그아웃을 눌렀는데 화면 변화가 없음»).
 * - 맨 위 줄(Header)은 화면을 옮겨도 그대로 남아 로그인 상태를 처음 한 번만 읽으므로, 새로 불러와야 «로그인» 버튼으로 바뀐다.
 * - 이 브라우저의 로그인만 끝낸다(scope local). 기본값(global)은 같은 계정의 다른 기기·탭 로그인까지 서버에서 지우는데,
 *   그러면 그쪽 화면은 로그인된 것처럼 남고 저장만 실패한다.
 * - 서버에 세션이 이미 없으면(403 session_not_found) supabase-js 는 오류만 돌려주고 이 브라우저에 저장된 로그인 정보를
 *   지우지 않는다. 그때는 여기서 직접 지운다.
 */
export async function logoutAndReload(): Promise<void> {
    leaving = true;
    const { error } = await supabase.auth.signOut({ scope: "local" }).catch(e => ({ error: e as Error }));
    if (error) {
        try {
            Object.keys(localStorage).filter(k => /^sb-.+-auth-token/.test(k)).forEach(k => localStorage.removeItem(k));
        } catch { /* 저장소를 못 쓰면 지울 것도 없다 */ }
    }
    window.location.assign("/");
}
