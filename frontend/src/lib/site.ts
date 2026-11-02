/**
 * 사이트 기준 주소. 공유 미리보기·정규 주소·sitemap이 이 값으로 절대 주소를 만든다.
 * 도메인을 바꾸면 환경 변수 NEXT_PUBLIC_SITE_URL만 바꾼다.
 */
export const SITE_URL = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === "production" ? "https://pick-art.vercel.app" : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "피카 pica";
