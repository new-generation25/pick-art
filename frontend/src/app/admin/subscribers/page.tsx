"use client";

import { useState, useEffect } from "react";
import { AdminHeader } from "@/components/ui/AdminHeader";
import { Users, Trash2, Search, Link as LinkIcon, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
    Box, Container, Title, Text, Button, Group, Stack,
    TextInput, Table, Badge, ActionIcon, Paper, Avatar,
    rem, LoadingOverlay, SegmentedControl, ThemeIcon
} from "@mantine/core";

export default function AdminSubscribersPage() {
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchSubscribers();
    }, []);

    const fetchSubscribers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("subscribers")
            .select("*")
            .order("subscribed_at", { ascending: false });

        if (!error && data) {
            setSubscribers(data);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`정말로 ${email} 구독자를 삭제하시겠습니까?`)) return;

        const { error } = await supabase
            .from("subscribers")
            .delete()
            .eq("id", id);

        if (!error) {
            setSubscribers(subscribers.filter(sub => sub.id !== id));
        } else {
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    const filteredSubscribers = subscribers.filter(sub => {
        if (filter === "active" && !sub.is_active) return false;
        if (filter === "inactive" && sub.is_active) return false;
        if (search && !sub.email.includes(search)) return false;
        return true;
    });

    return (
        <Box bg="gray.0" mih="100vh" pb={80}>
            <AdminHeader />
            <Container size="lg" pt={120}>

                {/* Header */}
                <Group justify="space-between" align="end" mb={40}>
                    <Group gap="sm">
                        <ThemeIcon size={48} radius="xl" color="pink" variant="light">
                            <Users size={24} />
                        </ThemeIcon>
                        <Box>
                            <Title order={1} size={rem(32)} fw={900}>구독자 관리</Title>
                            <Text c="dimmed" fw={500}>뉴스레터 구독자 목록을 확인하고 관리합니다.</Text>
                        </Box>
                    </Group>
                    <Title order={2} size="h1" c="indigo" fw={900} style={{ fontSize: rem(48), lineHeight: 1 }}>
                        {subscribers.length}
                    </Title>
                </Group>

                <Paper p="xl" radius="xl" withBorder shadow="sm">
                    {/* Controls */}
                    <Group justify="space-between" mb="xl">
                        <SegmentedControl
                            value={filter}
                            onChange={setFilter}
                            data={[
                                { label: '전체', value: 'all' },
                                { label: '활성', value: 'active' },
                                { label: '비활성', value: 'inactive' },
                            ]}
                            size="md"
                            radius="xl"
                        />
                        <TextInput
                            placeholder="이메일 검색..."
                            leftSection={<Search size={16} />}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            size="md"
                            radius="xl"
                            style={{ flex: 1, maxWidth: 300 }}
                        />
                    </Group>

                    {/* Table */}
                    <Box style={{ position: 'relative', minHeight: 200 }}>
                        <LoadingOverlay visible={loading} overlayProps={{ radius: 'sm', blur: 2 }} />

                        {filteredSubscribers.length === 0 && !loading ? (
                            <Stack align="center" py={60} c="dimmed">
                                <Users size={48} style={{ opacity: 0.3 }} />
                                <Text fw={700}>검색 결과가 없습니다.</Text>
                            </Stack>
                        ) : (
                            <Table verticalSpacing="sm" highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th w={60}>#</Table.Th>
                                        <Table.Th>이메일</Table.Th>
                                        <Table.Th>상태</Table.Th>
                                        <Table.Th>구독일</Table.Th>
                                        <Table.Th style={{ textAlign: 'right' }}>관리</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredSubscribers.map((sub, index) => (
                                        <Table.Tr key={sub.id}>
                                            <Table.Td>
                                                <Text size="sm" c="dimmed">{index + 1}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <Avatar size="sm" color="indigo" radius="xl">
                                                        <Mail size={14} />
                                                    </Avatar>
                                                    <Text size="sm" fw={600}>{sub.email}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                {sub.is_active ? (
                                                    <Badge color="green" variant="light">구독중</Badge>
                                                ) : (
                                                    <Badge color="gray" variant="light">해지됨</Badge>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm" c="dimmed">
                                                    {new Date(sub.subscribed_at).toLocaleDateString()}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td style={{ textAlign: 'right' }}>
                                                <ActionIcon
                                                    variant="subtle"
                                                    color="red"
                                                    onClick={() => handleDelete(sub.id, sub.email)}
                                                >
                                                    <Trash2 size={16} />
                                                </ActionIcon>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
