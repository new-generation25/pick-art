/** pica 인스타그램 계정 링크. 머리말(아이콘)과 꼬리말(글자)에서 쓴다 */
export const INSTAGRAM_URL = "https://www.instagram.com/picka.news/";

export function InstagramIcon({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
        </svg>
    );
}
