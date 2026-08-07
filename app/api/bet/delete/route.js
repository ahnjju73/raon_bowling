import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(req) {
  const { userId, betId } = await req.json();

  if (!userId || !betId) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  // 1. 배팅 기록 조회
  const { data: bet, error: betError } = await supabaseAdmin
    .from('bets')
    .select('*')
    .eq('id', betId)
    .eq('user_id', userId)
    .single();

  if (betError || !bet) {
    return NextResponse.json({ error: '배팅 기록을 찾을 수 없습니다.' }, { status: 404 });
  }

  // 2. 이미 정산된 배팅은 삭제 불가
  if (bet.settled) {
    return NextResponse.json({ error: '이미 정산된 배팅은 삭제할 수 없습니다.' }, { status: 400 });
  }

  // 3. 경기 상태 확인 (마감되지 않은 경기만 삭제 가능)
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select('deadline, status')
    .eq('id', bet.match_id)
    .single();

  if (match && (match.status !== 'OPEN' || new Date(match.deadline) < new Date())) {
    return NextResponse.json({ error: '마감된 경기의 배팅은 삭제할 수 없습니다.' }, { status: 400 });
  }

  // 4. 포인트 원자적 환불
  const { error: refundError } = await supabaseAdmin.rpc('increment_points', {
    p_user_id: userId,
    p_delta: bet.points_bet,
  });

  if (refundError) {
    return NextResponse.json({ error: '포인트 환불 실패' }, { status: 500 });
  }

  // 5. 배팅 기록 삭제
  const { error: deleteError } = await supabaseAdmin
    .from('bets')
    .delete()
    .eq('id', betId);

  if (deleteError) {
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }

  return NextResponse.json({ success: true, pointsRefunded: bet.points_bet });
}
