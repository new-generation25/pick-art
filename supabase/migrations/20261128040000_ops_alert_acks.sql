-- 수집기 경고 «확인» (운영자 2026-11-28 «현황에 경고1 있는건 왜 안없지냐고(확인 하면 없어지는 걸로)»).
-- 경고는 수집기가 ops_snapshots.collector_alerts 에 매 회차 다시 쓴다. 관리자가 «확인»한 경고의 열쇠만 여기에 남겨
-- 메뉴 숫자와 «살펴볼 것»에서 뺀다. 열쇠 = 규칙|대상|켜진 시각 → 같은 문제가 나중에 다시 켜지면(시각이 바뀌면) 다시 보인다.
-- 관리자만 읽고 쓴다. 지우기(되돌리기)도 관리자만.

create table if not exists public.ops_alert_acks (
    key        text primary key check (char_length(key) between 1 and 300),
    text       text check (text is null or char_length(text) <= 500),   -- 확인할 때 보던 경고 문구(기록용)
    acked_at   timestamptz not null default now(),
    acked_by   uuid default auth.uid()
);

alter table public.ops_alert_acks enable row level security;

drop policy if exists "Admin read ops_alert_acks" on public.ops_alert_acks;
create policy "Admin read ops_alert_acks" on public.ops_alert_acks
    for select to authenticated using (public.is_admin());

drop policy if exists "Admin insert ops_alert_acks" on public.ops_alert_acks;
create policy "Admin insert ops_alert_acks" on public.ops_alert_acks
    for insert to authenticated with check (public.is_admin());

drop policy if exists "Admin delete ops_alert_acks" on public.ops_alert_acks;
create policy "Admin delete ops_alert_acks" on public.ops_alert_acks
    for delete to authenticated using (public.is_admin());

revoke all on public.ops_alert_acks from anon;
grant select, insert, delete on public.ops_alert_acks to authenticated;
