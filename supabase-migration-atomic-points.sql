-- ============================================
-- 포인트 동시성 버그 수정 마이그레이션
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
--
-- 문제: 기존 API들은 "포인트 조회 → JS에서 계산 → 저장" 방식이라,
--       동시에 여러 요청(예: 배팅 두 개를 거의 동시에 클릭)이 오면
--       나중 요청이 이전 요청의 변경을 덮어써서 포인트가 유실됨.
-- 해결: DB에서 단일 UPDATE 문으로 원자적으로 증감시키는 함수를 만들고,
--       API 코드는 이 함수를 RPC로 호출하도록 변경.
-- ============================================

create or replace function increment_points(p_user_id uuid, p_delta integer)
returns integer
language plpgsql
as $$
declare
  v_points integer;
begin
  update users
  set points = points + p_delta
  where id = p_user_id and points + p_delta >= 0
  returning points into v_points;

  if v_points is null then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  return v_points;
end;
$$;

-- 같은 마켓에 대한 중복 배팅을 DB 레벨에서도 확실히 막음
-- (동시에 같은 마켓에 두 번 배팅 요청이 들어오는 경우의 최종 방어선)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'uniq_bet_per_market'
  ) then
    alter table bets add constraint uniq_bet_per_market unique (user_id, match_id, market);
  end if;
end $$;
