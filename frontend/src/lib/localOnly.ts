import { NextResponse } from 'next/server';

/**
 * 이 PC의 파이썬 수집기를 실행하거나 .env.local 을 읽고 쓰는 API 는 배포 환경(Vercel)에서 동작하지 않고,
 * 로그인 검사도 없어서 공개 서버에 열어 두면 안 된다. Vercel 이 넣는 VERCEL 환경 변수로 배포 환경을 알아보고 막는다.
 */
export const LOCAL_ONLY_MESSAGE = '이 기능은 수집기가 있는 PC의 로컬 서버에서만 동작합니다.';

export function blockOnDeploy(): NextResponse | null {
    return process.env.VERCEL ? NextResponse.json({ error: LOCAL_ONLY_MESSAGE }, { status: 501 }) : null;
}
