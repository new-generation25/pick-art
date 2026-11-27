/**
 * 앱 안 브라우저 판정 (specs/023 FR-006). 인스타그램 같은 앱이 띄우는 브라우저에서는 구글 로그인이 막힌다
 * (구글이 앱 안 웹뷰의 로그인을 거절함). 그런 브라우저로 보이면 «외부 브라우저로 열기» 안내를 먼저 보여 준다.
 * 돌려주는 값: 앱 이름(안내 글에 씀) 또는 null(보통 브라우저이거나 알 수 없음)
 */
export function inAppBrowser(ua: string): string | null {
    if (/Instagram/i.test(ua)) return "인스타그램";
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "페이스북";
    if (/KAKAOTALK/i.test(ua)) return "카카오톡";
    if (/NAVER\(inapp/i.test(ua)) return "네이버";
    if (/\bLine\//i.test(ua)) return "라인";
    if (/Android.*; wv\)/i.test(ua)) return "앱";   // 안드로이드 웹뷰 공통 표시
    return null;
}

export const isAndroid = (ua: string) => /Android/i.test(ua);

/** 안드로이드에서 지금 주소를 크롬으로 여는 링크 */
export function chromeIntent(href: string): string {
    const u = new URL(href);
    // 주소의 #부분은 뺀다(intent 주소는 # 뒤를 자기 설정으로 읽는다)
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
