import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

function checkAdmin(password) {
  return password && password === process.env.ADMIN_PASSWORD;
}

export async function POST(req) {
  const { password, title, team_a, team_b, odds_a, odds_b, deadline } = await req.json();

  if (!checkAdmin(password)) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  if (!title || !team_a || !team_b || !deadline) {
    return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('matches').insert({
    title,
    team_a,
    team_b,
    odds_a: odds_a || 1.9,
    odds_b: odds_b || 1.9,
    deadline,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
