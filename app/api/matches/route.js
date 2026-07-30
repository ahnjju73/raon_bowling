import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

function checkAdmin(password) {
  return password && password === process.env.ADMIN_PASSWORD;
}

function buildEmptyScores(players) {
  return (players || []).map((name) => ({ name: (name || '').trim(), g1: null, g2: null, g3: null }));
}

function validateMatchInput(body) {
  const { title, team_a_name, team_b_name, players_a, players_b, deadline, benchmark_a, benchmark_b } = body;
  if (!title || !team_a_name || !team_b_name || !deadline) {
    return '필수 항목(제목, 팀명, 마감시각)을 모두 입력해주세요.';
  }
  if (!Array.isArray(players_a) || players_a.filter((n) => n && n.trim()).length !== 3) {
    return `${team_a_name} 선수 이름을 3명 모두 입력해주세요.`;
  }
  if (!Array.isArray(players_b) || players_b.filter((n) => n && n.trim()).length !== 3) {
    return `${team_b_name} 선수 이름을 3명 모두 입력해주세요.`;
  }
  if (benchmark_a === '' || benchmark_a === null || benchmark_a === undefined || isNaN(Number(benchmark_a))) {
    return `${team_a_name}의 업다운 기준점수(평균)를 입력해주세요.`;
  }
  if (benchmark_b === '' || benchmark_b === null || benchmark_b === undefined || isNaN(Number(benchmark_b))) {
    return `${team_b_name}의 업다운 기준점수(평균)를 입력해주세요.`;
  }
  return null;
}

// 경기 등록
export async function POST(req) {
  const body = await req.json();
  const { password, title, team_a_name, team_b_name, players_a, players_b, benchmark_a, benchmark_b, deadline } = body;

  if (!checkAdmin(password)) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다.' }, { status: 401 });
  }

  const validationError = validateMatchInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('matches').insert({
    title,
    team_a_name,
    team_b_name,
    scores_a: buildEmptyScores(players_a),
    scores_b: buildEmptyScores(players_b),
    benchmark_a: Number(benchmark_a),
    benchmark_b: Number(benchmark_b),
    deadline,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// 경기 수정 (정산 전까지만 가능)
export async function PATCH(req) {
  const body = await req.json();
  const { password, matchId, title, team_a_name, team_b_name, players_a, players_b, benchmark_a, benchmark_b, deadline } = body;

  if (!checkAdmin(password)) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  if (!matchId) {
    return NextResponse.json({ error: 'matchId가 필요합니다.' }, { status: 400 });
  }

  const validationError = validateMatchInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const { data: match, error: fetchError } = await supabaseAdmin
    .from('matches')
    .select('status, scores_a, scores_b')
    .eq('id', matchId)
    .single();

  if (fetchError || !match) {
    return NextResponse.json({ error: '경기를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (match.status === 'SETTLED') {
    return NextResponse.json({ error: '이미 정산된 경기는 수정할 수 없습니다.' }, { status: 400 });
  }

  // 기존에 입력된 점수가 있으면 이름만 바뀌고 점수는 유지되도록 병합
  const mergeScores = (existing, players) =>
    players.map((name, i) => ({
      name: (name || '').trim(),
      g1: existing?.[i]?.g1 ?? null,
      g2: existing?.[i]?.g2 ?? null,
      g3: existing?.[i]?.g3 ?? null,
    }));

  const { error } = await supabaseAdmin
    .from('matches')
    .update({
      title,
      team_a_name,
      team_b_name,
      scores_a: mergeScores(match.scores_a, players_a),
      scores_b: mergeScores(match.scores_b, players_b),
      benchmark_a: Number(benchmark_a),
      benchmark_b: Number(benchmark_b),
      deadline,
    })
    .eq('id', matchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
