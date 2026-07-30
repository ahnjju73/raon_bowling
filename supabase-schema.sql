-- ============================================
-- 동호회 토토 사이트 DB 스키마
-- Supabase 대시보드 > SQL Editor 에서 그대로 실행하세요.
-- ============================================

-- 1. 유저 테이블 (포인트 보유)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  points integer not null default 1000,
  created_at timestamptz default now()
);

-- 2. 경기 테이블 (관리자가 직접 입력)
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  team_a text not null,
  team_b text not null,
  odds_a numeric(4,2) not null default 1.90,
  odds_b numeric(4,2) not null default 1.90,
  deadline timestamptz not null,
  result text check (result in ('A', 'B', 'DRAW', null)) default null,
  status text check (status in ('OPEN', 'CLOSED', 'SETTLED')) default 'OPEN',
  created_at timestamptz default now()
);

-- 3. 배팅 기록 테이블
create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  match_id uuid references matches(id) not null,
  choice text check (choice in ('A', 'B')) not null,
  points_bet integer not null check (points_bet > 0),
  settled boolean default false,
  won boolean default null,
  points_won integer default 0,
  created_at timestamptz default now()
);

-- 인덱스
create index if not exists idx_bets_match on bets(match_id);
create index if not exists idx_bets_user on bets(user_id);

-- RLS(행 단위 보안) 활성화 - 최소한의 보호
alter table users enable row level security;
alter table matches enable row level security;
alter table bets enable row level security;

-- 누구나 읽기는 가능 (동호회 내부용이라 단순하게)
create policy "public read users" on users for select using (true);
create policy "public read matches" on matches for select using (true);
create policy "public read bets" on bets for select using (true);

-- 쓰기(등록/배팅)는 anon key로도 가능하게 허용 (내부용 단순 정책)
create policy "public insert users" on users for insert with check (true);
create policy "public insert bets" on bets for insert with check (true);

-- 정산/경기관리는 API route에서 service_role key로만 수행 (RLS 우회) -> 정책 불필요
