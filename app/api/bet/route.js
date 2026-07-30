import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

const VALID_MARKETS = {
  WINLOSE: ['A', 'B'],
  UPDOWN_A: ['UP', 'DOWN'],
  UPDOWN_B: ['UP', 'DOWN'],
};

export async function POST(req) {
  const { userId, matchId, market, choice, points } = await req.json();

  if (!userId || !matchId || !market || !choice || !points || points <= 0) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!VALID_MARKETS[market] || !VALID_MARKETS[market].includes(choice)) {
    return NextResponse.json({ error: '잘못된 배팅 항목입니다.' }, { status: 400 });
  }

  // 1. 경기 상태 확인
  const { data: match, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: '경기를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (match.status !== 'OPEN' || new Date(match.deadline) < new Date()) {
    return NextResponse.json({ error: '이미 마감된 경기입니다.' }, { status: 400 });
  }
  if ((market === 'UPDOWN_A' && match.benchmark_a === null) || (market === 'UPDOWN_B' && match.benchmark_b === null)) {
    return NextResponse.json({ error: '이 경기는 업다운 기준점수가 설정되어 있지 않습니다.' }, { status: 400 });
  }

  // 2. 같은 마켓에 중복 배팅 방지 (마켓별로 각 1건씩만 가능)
  const { data: existingBet } = await supabaseAdmin
    .from('bets')
    .select('id')
    .eq('user_id', userId)
    .eq('match_id', matchId)
    .eq('market', market)
    .maybeSingle();

  if (existingBet) {
    return NextResponse.json({ error: '이미 이 항목에 배팅했습니다.' }, { status: 400 });
  }

  // 3. 유저 포인트 확인
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('points')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return NextResponse.json({ error: '유저를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (user.points < points) {
    return NextResponse.json({ error: '보유 포인트가 부족합니다.' }, { status: 400 });
  }

  // 4. 포인트 차감
  const { error: deductError } = await supabaseAdmin
    .from('users')
    .update({ points: user.points - points })
    .eq('id', userId);

  if (deductError) {
    return NextResponse.json({ error: '포인트 차감 실패' }, { status: 500 });
  }

  // 5. 배팅 기록 생성
  const { error: betError } = await supabaseAdmin
    .from('bets')
    .insert({ user_id: userId, match_id: matchId, market, choice, points_bet: points });

  if (betError) {
    // 롤백
    await supabaseAdmin.from('users').update({ points: user.points }).eq('id', userId);
    return NextResponse.json({ error: '배팅 기록 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
