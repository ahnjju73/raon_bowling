import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';

function checkAdmin(password) {
  return password && password === process.env.ADMIN_PASSWORD;
}

// amount는 양수(지급)/음수(차감) 모두 가능
export async function POST(req) {
  const { password, userId, amount } = await req.json();

  if (!checkAdmin(password)) {
    return NextResponse.json({ error: '관리자 비밀번호가 틀렸습니다.' }, { status: 401 });
  }
  if (!userId || !amount || Number(amount) === 0) {
    return NextResponse.json({ error: '유저와 포인트 값을 입력해주세요.' }, { status: 400 });
  }

  const { data: user, error: userError } = await supabaseAdmin.from('users').select('points').eq('id', userId).single();
  if (userError || !user) {
    return NextResponse.json({ error: '유저를 찾을 수 없습니다.' }, { status: 404 });
  }

  const newPoints = user.points + Number(amount);
  if (newPoints < 0) {
    return NextResponse.json({ error: '포인트가 0보다 작아질 수 없습니다.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('users').update({ points: newPoints }).eq('id', userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, newPoints });
}
