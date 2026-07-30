import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

function checkAdmin(password) {
  return password && password === process.env.ADMIN_PASSWORD;
}

export async function POST(req) {
  const { password, matchId, result } = await req.json();

  if (!checkAdmin(password)) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  if (!matchId || !['A', 'B'].includes(result)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: '경기를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (match.status === 'SETTLED') {
    return NextResponse.json({ error: '이미 정산된 경기입니다.' }, { status: 400 });
  }

  const { data: bets, error: betsError } = await supabaseAdmin
    .from('bets')
    .select('*')
    .eq('match_id', matchId);

  if (betsError) {
    return NextResponse.json({ error: betsError.message }, { status: 500 });
  }

  const odds = result === 'A' ? Number(match.odds_a) : Number(match.odds_b);

  for (const bet of bets) {
    const won = bet.choice === result;
    const pointsWon = won ? Math.round(bet.points_bet * odds) : 0;

    await supabaseAdmin
      .from('bets')
      .update({ settled: true, won, points_won: pointsWon })
      .eq('id', bet.id);

    if (won) {
      const { data: user } = await supabaseAdmin.from('users').select('points').eq('id', bet.user_id).single();
      if (user) {
        await supabaseAdmin.from('users').update({ points: user.points + pointsWon }).eq('id', bet.user_id);
      }
    }
  }

  await supabaseAdmin.from('matches').update({ result, status: 'SETTLED' }).eq('id', matchId);

  return NextResponse.json({ success: true, settledCount: bets.length });
}
