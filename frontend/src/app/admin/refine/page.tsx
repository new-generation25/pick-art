"use client";

import { Container, Stack, Text, Title } from "@mantine/core";
import { GenrePending } from "@/components/admin/GenrePending";
import { PlaceholderCandidates } from "@/components/admin/PlaceholderCandidates";

// 대기함 › 정보 다듬기 (specs/019): 규칙으로 정하지 못한 세부 갈래와, 여러 행사에 같은 그림이 쓰인 안내 그림 후보.
// 예전에는 대시보드 중간에 끼어 있었다
export default function RefinePage() {
    return (
        <Container fluid px={0} pt={24} pb={40}>
            <Stack gap="lg">
                <div>
                    <Title order={2} fw={900}>세부 갈래 · 안내 그림</Title>
                    <Text c="dimmed" size="sm">정기 실행이 규칙으로 정하지 못해 넘긴 것입니다. 고르면 목록에서 빠집니다.</Text>
                </div>
                <GenrePending />
                <PlaceholderCandidates />
            </Stack>
        </Container>
    );
}
