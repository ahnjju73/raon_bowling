'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

const MARKET_LABEL = { WINLOSE: '승부', UPDOWN_A: '업다운', UPDOWN_B: '업다운' };

export default function HomePage() {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [points, setPoints] = useState(null);
  const [matches, setMatches] = useState([]);
  const [allBets, setAllBets] = useState([]); // 전체 유저의 배팅 (판돈 규모 표시용)
  const [myBets, setMyBets] = useState([]);
  const [selections, setSelections] = useState({}); // `${matchId}:${market}` -> choice
  const [amounts, setAmounts] = useState({}); // `${matchId}:${market}` -> amount
  const [msg, setMsg] = useState({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [bettingInProgress, setBettingInProgress] = useState({});

  const loadData = useCallback(async (uid) => {
    const { data: userRow } = await supabase.from('users').select('points, name').eq('id', uid).single();
    if (userRow) {
      setPoints(userRow.points);
      setUserName(userRow.name);
    }

    const { data: matchRows } = await supabase.from('matches').select('*').order('deadline', { ascending: true });
    setMatches(matchRows || []);

    const { data: betRows } = await supabase.from('bets').select('*');
    setAllBets(betRows || []);
    setMyBets((betRows || []).filter((b) => b.user_id === uid));

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

  async function placeBet(matchId, market) {
    const k = key(matchId, market);
    
    // ✅ 이미 진행 중이면 무시
    if (bettingInProgress[k]) {
      return;
    }

    const choice = selections[k];
    const amount = Number(amounts[k]);
    setMsg((m) => ({ ...m, [k]: null }));

    if (!choice) {
      setMsg((m) => ({ ...m, [k]: { type: 'error', text: '항목을 선택해주세요.' } }));
      return;
    }
    if (!amount || amount <= 0) {
      setMsg((m) => ({ ...m, [k]: { type: 'error', text: '배팅 포인트를 입력해주세요.' } }));
      return;
    }
    if (amount > points) {
      setMsg((m) => ({ ...m, [k]: { type: 'error', text: '보유 포인트가 부족합니다.' } }));
      return;
    }

    // ✅ 진행 중 표시
    setBettingInProgress((b) => ({ ...b, [k]: true }));

    const res = await fetch('/api/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, matchId, market, choice, points: amount }),
    });
    const data = await res.json();

    // ✅ 진행 중 해제
    setBettingInProgress((b) => ({ ...b, [k]: false }));

    if (!res.ok) {
      setMsg((m) => ({ ...m, [k]: { type: 'error', text: data.error || '배팅 실패' } }));
      return;
    }
    setMsg((m) => ({ ...m, [k]: { type: 'success', text: '배팅 완료!' } }));
    loadData(userId);
  }

  function key(matchId, market) {
    return `${matchId}:${market}`;
  }

  function poolFor(matchId, market, choice) {
    return allBets
      .filter((b) => b.match_id === matchId && b.market === market && b.choice === choice)
      .reduce((s, b) => s + b.points_bet, 0);
  }

  function myBetFor(matchId, market) {
    return myBets.find((b) => b.match_id === matchId && b.market === market);
  }

  function select(matchId, market, choice) {
    setSelections((s) => ({ ...s, [key(matchId, market)]: choice }));
  }
  function setAmount(matchId, market, value) {
    setAmounts((a) => ({ ...a, [key(matchId, market)]: value }));
  }


  async function deleteBet(betId) {
    if (!confirm('이 배팅을 삭제하고 포인트를 환불받으시겠습니까?')) return;

    const res = await fetch('/api/bet/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, betId }),
    });
    const data = await res.json();

    if (!res.ok) {
      alert('삭제 실패: ' + data.error);
      return;
    }
    alert(`삭제 완료! ${data.pointsRefunded}P 환불되었습니다.`);
    loadData(userId);
  }

  function logout() {
    localStorage.removeItem('toto_user_id');
    localStorage.removeItem('toto_user_name');
    router.push('/login');
  }

  function teamTotal(players) {
    return (players || []).reduce((sum, p) => sum + (Number(p.g1) || 0) + (Number(p.g2) || 0) + (Number(p.g3) || 0), 0);
  }

  if (loading) return <div className="container"><p className="empty">불러오는 중...</p></div>;

  const openMatches = matches.filter((m) => m.status !== 'SETTLED');
  const settledMatches = matches.filter((m) => m.status === 'SETTLED');

  return (
    <>
      <div className="header">
        <h1>🎳 라온 3인조 토토</h1>
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
          const playersA = (match.scores_a || []).map((p) => p.name).join(', ');
          const playersB = (match.scores_b || []).map((p) => p.name).join(', ');

          return (
            <div className="card" key={match.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="match-title">{match.title}</div>
                <span className={`status-tag ${isClosed ? 'closed' : 'open'}`}>{isClosed ? '마감' : '배팅 가능'}</span>
              </div>

              {/* 승부 예측 */}
              <BetSection
                label="🏆 승부 예측"
                matchId={match.id}
                market="WINLOSE"
                isClosed={isClosed}
                options={[
                  { choice: 'A', name: match.team_a_name, sub: playersA },
                  { choice: 'B', name: match.team_b_name, sub: playersB },
                ]}
                pool={(choice) => poolFor(match.id, 'WINLOSE', choice)}
                myBet={myBetFor(match.id, 'WINLOSE')}
                selections={selections}
                amounts={amounts}
                select={select}
                setAmount={setAmount}
                placeBet={placeBet}
                msg={msg}
                choiceLabelFn={(c) => (c === 'A' ? match.team_a_name : match.team_b_name)}
              />

              {/* A팀 업다운 */}
              {match.benchmark_a !== null && (
                <BetSection
                  label={`📈 ${match.team_a_name} 업다운 (기준 ${match.benchmark_a}점)`}
                  matchId={match.id}
                  market="UPDOWN_A"
                  isClosed={isClosed}
                  options={[
                    { choice: 'UP', name: '업 (UP)', sub: `기준 ${match.benchmark_a}점 초과` },
                    { choice: 'DOWN', name: '다운 (DOWN)', sub: `기준 ${match.benchmark_a}점 미만` },
                  ]}
                  pool={(choice) => poolFor(match.id, 'UPDOWN_A', choice)}
                  myBet={myBetFor(match.id, 'UPDOWN_A')}
                  selections={selections}
                  amounts={amounts}
                  select={select}
                  setAmount={setAmount}
                  placeBet={placeBet}
                  msg={msg}
                  choiceLabelFn={(c) => (c === 'UP' ? '업(UP)' : '다운(DOWN)')}
                />
              )}

              {/* B팀 업다운 */}
              {match.benchmark_b !== null && (
                <BetSection
                  label={`📈 ${match.team_b_name} 업다운 (기준 ${match.benchmark_b}점)`}
                  matchId={match.id}
                  market="UPDOWN_B"
                  isClosed={isClosed}
                  options={[
                    { choice: 'UP', name: '업 (UP)', sub: `기준 ${match.benchmark_b}점 초과` },
                    { choice: 'DOWN', name: '다운 (DOWN)', sub: `기준 ${match.benchmark_b}점 미만` },
                  ]}
                  pool={(choice) => poolFor(match.id, 'UPDOWN_B', choice)}
                  myBet={myBetFor(match.id, 'UPDOWN_B')}
                  selections={selections}
                  amounts={amounts}
                  select={select}
                  setAmount={setAmount}
                  placeBet={placeBet}
                  msg={msg}
                  choiceLabelFn={(c) => (c === 'UP' ? '업(UP)' : '다운(DOWN)')}
                />
              )}
            </div>
          );
        })}

        {settledMatches.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, color: 'var(--muted)', margin: '30px 0 10px' }}>지난 경기 결과</h2>
            {settledMatches.map((match) => {
              const totalA = teamTotal(match.scores_a);
              const totalB = teamTotal(match.scores_b);
              const avgA = (totalA / 3).toFixed(1);
              const avgB = (totalB / 3).toFixed(1);
              return (
                <div className="card" key={match.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="match-title">{match.title}</div>
                    <span className="status-tag settled">SETTLED</span>
                  </div>
                  <div className="teams">
                    <div className={`team-btn ${match.result === 'A' ? 'selected' : ''}`} style={{ cursor: 'default' }}>
                      <div className="name">{match.team_a_name} {match.result === 'A' && '🏆'}</div>
                      <div className="odds">{totalA}점 (평균 {avgA})</div>
                      {match.result_updown_a && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                          업다운: {match.result_updown_a === 'PUSH' ? '무효(동률)' : match.result_updown_a}
                        </div>
                      )}
                    </div>
                    <div className={`team-btn ${match.result === 'B' ? 'selected' : ''}`} style={{ cursor: 'default' }}>
                      <div className="name">{match.team_b_name} {match.result === 'B' && '🏆'}</div>
                      <div className="odds">{totalB}점 (평균 {avgB})</div>
                      {match.result_updown_b && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                          업다운: {match.result_updown_b === 'PUSH' ? '무효(동률)' : match.result_updown_b}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <h2 style={{ fontSize: 15, color: 'var(--muted)', margin: '30px 0 10px' }}>내 배팅 내역</h2>
        <div className="card">
          {myBets.length === 0 && <p className="empty">배팅 내역이 없습니다.</p>}
          {myBets.map((b) => {
            const match = matches.find((m) => m.id === b.match_id);
            const choiceLabel =
              b.market === 'WINLOSE'
                ? (b.choice === 'A' ? match?.team_a_name : match?.team_b_name)
                : (b.choice === 'UP' ? '업(UP)' : '다운(DOWN)');
            const isClosed = match && (match.status !== 'OPEN' || new Date(match.deadline) < new Date());
            const canDelete = !b.settled && !isClosed;

            return (
              <div key={b.id} style={{ marginBottom: 12 }}>
                <div className="bet-history-item">
                  <span>
                    {match?.title} · {MARKET_LABEL[b.market]}({choiceLabel}) · {b.points_bet}P
                  </span>
                  <span style={{ color: !b.settled ? 'var(--muted)' : b.won === null ? 'var(--muted)' : b.won ? 'var(--accent-2)' : 'var(--danger)' }}>
                    {!b.settled ? '결과 대기' : b.won === null ? `환불 ${b.points_won}P` : b.won ? `+${b.points_won}P 적중` : '낙첨'}
                  </span>
                </div>
                {canDelete && (
                  <button 
                    className="ghost" 
                    style={{ fontSize: 12, padding: '4px 8px', marginTop: 6 }}
                    onClick={() => deleteBet(b.id)}
                  >
                    삭제하기
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', marginTop: 30 }}>
          <a href="/admin" style={{ color: 'var(--muted)', fontSize: 13 }}>관리자 페이지 →</a>
        </p>
      </div>
    </>
  );
}

function BetSection({ label, matchId, market, isClosed, options, pool, myBet, selections, amounts, select, setAmount, placeBet, msg, choiceLabelFn }) {
  const k = `${matchId}:${market}`;
  const totalPool = options.reduce((s, o) => s + pool(o.choice), 0);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div className="teams">
        {options.map((o) => (
          <div
            key={o.choice}
            className={`team-btn ${selections[k] === o.choice ? 'selected' : ''}`}
            onClick={() => !isClosed && !myBet && select(matchId, market, o.choice)}
            style={{ opacity: isClosed || myBet ? 0.6 : 1 }}
          >
            <div className="name">{o.name}</div>
            {o.sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{o.sub}</div>}
            <div className="odds">판돈 {pool(o.choice)}P</div>
          </div>
        ))}
      </div>
      {totalPool > 0 && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -6, marginBottom: 8 }}>
          전체 판돈 {totalPool}P (적중자끼리 배팅 비율대로 나눠 가짐)
        </p>
      )}

      {myBet ? (
        <p className="msg success">이미 배팅함: {choiceLabelFn(myBet.choice)} · {myBet.points_bet}P</p>
      ) : (
        !isClosed && (
          <div className="bet-row">
            <input
              type="number"
              placeholder="포인트"
              value={amounts[k] || ''}
              onChange={(e) => setAmount(matchId, market, e.target.value)}
            />
            <button 
              className="primary" 
              onClick={() => placeBet(matchId, market)}
              disabled={bettingInProgress[k]}  // ✅ 진행 중이면 버튼 비활성화
            >
              {bettingInProgress[k] ? '배팅 중...' : '배팅'}
            </button>
          </div>
        )
      )}
      {msg[k] && <p className={`msg ${msg[k].type}`}>{msg[k].text}</p>}
    </div>
  );
}
