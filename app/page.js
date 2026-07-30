'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function HomePage() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [points, setPoints] = useState(null);
  const [matches, setMatches] = useState([]);
  const [myBets, setMyBets] = useState([]);
  const [selections, setSelections] = useState({}); // matchId -> 'A' | 'B'
  const [amounts, setAmounts] = useState({}); // matchId -> number
  const [msg, setMsg] = useState({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadData = useCallback(async (uid) => {
    const { data: userRow } = await supabase.from('users').select('points, name').eq('id', uid).single();
    if (userRow) {
      setPoints(userRow.points);
      setUserName(userRow.name);
    }

    const { data: matchRows } = await supabase
      .from('matches')
      .select('*')
      .order('deadline', { ascending: true });
    setMatches(matchRows || []);

    const { data: betRows } = await supabase
      .from('bets')
      .select('*, matches(title, team_a, team_b, result, status)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    setMyBets(betRows || []);

    setLoading(false);
  }, []);

  useEffect(() => {
    const uid = localStorage.getItem('toto_user_id');
    if (!uid) {
      router.push('/login');
      return;
    }
    setUserId(uid);
    loadData(uid);
  }, [loadData, router]);

  function selectTeam(matchId, choice) {
    setSelections((s) => ({ ...s, [matchId]: choice }));
  }

  function setAmount(matchId, value) {
    setAmounts((a) => ({ ...a, [matchId]: value }));
  }

  async function placeBet(match) {
    const choice = selections[match.id];
    const amount = Number(amounts[match.id]);
    setMsg((m) => ({ ...m, [match.id]: null }));

    if (!choice) {
      setMsg((m) => ({ ...m, [match.id]: { type: 'error', text: '팀을 선택해주세요.' } }));
      return;
    }
    if (!amount || amount <= 0) {
      setMsg((m) => ({ ...m, [match.id]: { type: 'error', text: '배팅 포인트를 입력해주세요.' } }));
      return;
    }
    if (amount > points) {
      setMsg((m) => ({ ...m, [match.id]: { type: 'error', text: '보유 포인트가 부족합니다.' } }));
      return;
    }

    const res = await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, matchId: match.id, choice, points: amount }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMsg((m) => ({ ...m, [match.id]: { type: 'error', text: data.error || '배팅 실패' } }));
      return;
    }

    setMsg((m) => ({ ...m, [match.id]: { type: 'success', text: '배팅 완료!' } }));
    loadData(userId);
  }

  function logout() {
    localStorage.removeItem('toto_user_id');
    localStorage.removeItem('toto_user_name');
    router.push('/login');
  }

  if (loading) return <div className="container"><p className="empty">불러오는 중...</p></div>;

  const openMatches = matches.filter((m) => m.status !== 'SETTLED');

  return (
    <>
      <div className="header">
        <h1>🏆 동호회 토토</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="points-badge">{userName} · {points}P</span>
          <button className="ghost" onClick={logout}>로그아웃</button>
        </div>
      </div>

      <div className="container">
        <h2 style={{ fontSize: 15, color: 'var(--muted)', margin: '20px 0 10px' }}>진행 중인 경기</h2>

        {openMatches.length === 0 && <p className="empty">아직 등록된 경기가 없습니다.</p>}

        {openMatches.map((match) => {
          const isClosed = match.status !== 'OPEN' || new Date(match.deadline) < new Date();
          const myBetForMatch = myBets.find((b) => b.match_id === match.id);

          return (
            <div className="card" key={match.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="match-title">{match.title}</div>
                <span className={`status-tag ${isClosed ? 'closed' : 'open'}`}>
                  {isClosed ? '마감' : '배팅 가능'}
                </span>
              </div>

              <div className="teams">
                <div
                  className={`team-btn ${selections[match.id] === 'A' ? 'selected' : ''}`}
                  onClick={() => !isClosed && !myBetForMatch && selectTeam(match.id, 'A')}
                  style={{ opacity: isClosed || myBetForMatch ? 0.6 : 1 }}
                >
                  <div className="name">{match.team_a}</div>
                  <div className="odds">배당 {match.odds_a}</div>
                </div>
                <div
                  className={`team-btn ${selections[match.id] === 'B' ? 'selected' : ''}`}
                  onClick={() => !isClosed && !myBetForMatch && selectTeam(match.id, 'B')}
                  style={{ opacity: isClosed || myBetForMatch ? 0.6 : 1 }}
                >
                  <div className="name">{match.team_b}</div>
                  <div className="odds">배당 {match.odds_b}</div>
                </div>
              </div>

              {myBetForMatch ? (
                <p className="msg success">
                  이미 배팅함: {myBetForMatch.choice === 'A' ? match.team_a : match.team_b} · {myBetForMatch.points_bet}P
                </p>
              ) : (
                !isClosed && (
                  <div className="bet-row">
                    <input
                      type="number"
                      placeholder="포인트"
                      value={amounts[match.id] || ''}
                      onChange={(e) => setAmount(match.id, e.target.value)}
                    />
                    <button className="primary" onClick={() => placeBet(match)}>배팅</button>
                  </div>
                )
              )}

              {msg[match.id] && <p className={`msg ${msg[match.id].type}`}>{msg[match.id].text}</p>}
            </div>
          );
        })}

        <h2 style={{ fontSize: 15, color: 'var(--muted)', margin: '30px 0 10px' }}>내 배팅 내역</h2>
        <div className="card">
          {myBets.length === 0 && <p className="empty">배팅 내역이 없습니다.</p>}
          {myBets.map((b) => (
            <div className="bet-history-item" key={b.id}>
              <span>
                {b.matches?.title} · {b.choice === 'A' ? b.matches?.team_a : b.matches?.team_b} · {b.points_bet}P
              </span>
              <span style={{ color: b.settled ? (b.won ? 'var(--accent-2)' : 'var(--danger)') : 'var(--muted)' }}>
                {b.settled ? (b.won ? `+${b.points_won}P 적중` : '낙첨') : '결과 대기'}
              </span>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 30 }}>
          <a href="/admin" style={{ color: 'var(--muted)', fontSize: 13 }}>관리자 페이지 →</a>
        </p>
      </div>
    </>
  );
}
