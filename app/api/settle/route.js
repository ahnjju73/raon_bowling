import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { computePariMutuelPayouts } from '../../../lib/payout';

function checkAdmin(password) {
  return password && password === process.env.ADMIN_PASSWORD;
}

function sumTeam(scores) {
  return scores.reduce((sum, p) => sum + (Number(p.g1) || 0) + (Number(p.g2) || 0) + (Number(p.g3) || 0), 0);
}

function validateScores(scores, teamName) {
  if (!Array.isArray(scores) || scores.length !== 3) return `${teamName} 선수 3명의 점수가 필요합니다.`;
  for (const p of scores) {
    if (p.g1 === null || p.g1 === '' || p.g2 === null || p.g2 === '' || p.g3 === null || p.g3 === '') {
      return `${teamName} - ${p.name} 선수의 3게임 점수를 모두 입력해주세요.`;
    }
  }
  return null;
}

async function settleMarket(matchId, market, winningChoice) {
  const { data: bets, error } = await supabaseAdmin.from('bets').select('*').eq('match_id', matchId).eq('market', market);
  if (error) throw new Error(error.message);
  if (!bets || bets.length === 0) return 0;

  const payouts = computePariMutuelPayouts(bets, winningChoice);

  for (const p of payouts) {
    await supabaseAdmin.from('bets').update({ settled: true, won: p.won, points_won: p.points_won }).eq('id', p.id);
    if (p.points_won > 0) {
      const bet = bets.find((b) => b.id === p.id);
      const { data: user } = await supabaseAdmin.from('users').select('points').eq('id', bet.user_id).single();
      if (user) {
        await supabaseAdmin.from('users').update({ points: user.points + p.points_won }).eq('id', bet.user_id);
      }
    }
  }
  return bets.length;
}

export async function POST(req) {
  const { password, matchId, scoresA, scoresB } = await req.json();

  if (!checkAdmin(password)) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  if (!matchId) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { data: match, error: matchError } = await supabaseAdmin.from('matches').select('*').eq('id', matchId).single();
  if (matchError || !match) {
    return NextResponse.json({ error: '경기를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (match.status === 'SETTLED') {
    return NextResponse.json({ error: '이미 정산된 경기입니다.' }, { status: 400 });
  }

  const errA = validateScores(scoresA, match.team_a_name);
  if (errA) return NextResponse.json({ error: errA }, { status: 400 });
  const errB = validateScores(scoresB, match.team_b_name);
  if (errB) return NextResponse.json({ error: errB }, { status: 400 });

  const totalA = sumTeam(scoresA);
  const totalB = sumTeam(scoresB);

  if (totalA === totalB) {
    return NextResponse.json(
      { error: `두 팀 총점이 ${totalA}점으로 동점입니다. 연장 게임 등으로 승부를 가린 뒤 점수를 조정해서 다시 입력해주세요.` },
      { status: 400 }
    );
  }

  const winloseResult = totalA > totalB ? 'A' : 'B';
  const avgA = totalA / 3;
  const avgB = totalB / 3;

  const updownResult = (avg, benchmark) => {
    if (benchmark === null || benchmark === undefined) return null;
    if (avg > Number(benchmark)) return 'UP';
    if (avg < Number(benchmark)) return 'DOWN';
    return 'PUSH';
  };

  const resultUpdownA = updownResult(avgA, match.benchmark_a);
  const resultUpdownB = updownResult(avgB, match.benchmark_b);

  try {
    const settledWinlose = await settleMarket(matchId, 'WINLOSE', winloseResult);
    const settledUpA = await settleMarket(matchId, 'UPDOWN_A', resultUpdownA === 'PUSH' ? null : resultUpdownA);
    const settledUpB = await settleMarket(matchId, 'UPDOWN_B', resultUpdownB === 'PUSH' ? null : resultUpdownB);

    const { error: updateError } = await supabaseAdmin
      .from('matches')
      .update({
        scores_a: scoresA,
        scores_b: scoresB,
        total_a: totalA,
        total_b: totalB,
        result: winloseResult,
        result_updown_a: resultUpdownA,
        result_updown_b: resultUpdownB,
        status: 'SETTLED',
      })
      .eq('id', matchId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      totalA,
      totalB,
      result: winloseResult,
      resultUpdownA,
      resultUpdownB,
      settledCount: settledWinlose + settledUpA + settledUpB,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
