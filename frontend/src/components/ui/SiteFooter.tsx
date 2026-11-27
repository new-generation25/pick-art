import Link from "next/link";
import { Box, Container, Group, Text } from "@mantine/core";
import { INSTAGRAM_URL, InstagramIcon } from "./InstagramLink";

const linkClass = "text-[13px] font-bold text-ink underline-offset-4 hover:underline";

/** 공개 화면 꼬리말: 브랜드, 인스타그램, 이용약관, 개인정보처리방침 */
export function SiteFooter() {
    return (
        <Box component="footer" py={32} bg="var(--pk-paper)" style={{ borderTop: '2px solid var(--pk-line)' }}>
            <Container size="xl">
                <Group justify="space-between" gap="xs">
                    <Group gap="md">
                        <Text fz="sm" fw={700} c="var(--pk-ink)">pica · 가까운 공연·전시·축제</Text>
                        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-bold text-ink underline-offset-4 hover:underline">
                            <InstagramIcon size={16} /> 인스타그램 @picka.news
                        </a>
                    </Group>
                    <Group gap="md">
                        <Link href="/about" className={linkClass}>피카 소개</Link>
                        <Link href="/partners" className={linkClass}>단체·공간 안내</Link>
                        <Link href="/tip" className={linkClass}>행사 제보하기</Link>
                        <Link href="/calendar" className={linkClass}>캘린더로 받아 보기</Link>
                        <Link href="/terms" className={linkClass}>이용약관</Link>
                        <Link href="/privacy" className={linkClass}>개인정보처리방침</Link>
                        <Text fz="xs" c="var(--pk-ink-soft)">&copy; 2024 pickart (pica). All rights reserved.</Text>
                    </Group>
                </Group>
            </Container>
        </Box>
    );
}
