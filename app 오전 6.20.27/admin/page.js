'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

const emptyPlayers = ['', '', ''];
const emptyForm = {
  matchId: null,
  title: '',
  team_a_name: '',
  team_b_name: '',
  players_a: [...emptyPlayers],
  players_b: [...emptyPlayers],
  odds_a: '1.9',
  odds_b: '1.9',
  deadline: '',
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState('points'); // points | matches | results

  if (!unlocked) {
    return (
      <div className="container" style={{ maxWidth: 360, paddingTop: 80 }}>
        <h1 style={{ textAlign: 'center' }}>🔐 관리자 로그인</h1>
        <div className="card">
          <div className="form-group">
            <label>관리자 비밀번호</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="primary" style={{ width: '100%' }} onClick={() => setUnlocked(true)}>
            입장
          </button>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            * 비밀번호는 서버에서 각 요청마다 검증됩니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>⚙️ 관리자 페이지</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={tab === 'points' ? 'primary' : 'ghost'} onClick={() => setTab('points')}>포인트 지급</button>
        <button className={tab === 'matches' ? 'primary' : 'ghost'} onClick={() => setTab('matches')}>경기 등록·수정</button>
        <button className={tab === 'results' ? 'primary' : 'ghost'} onClick={() => setTab('results')}>결과 입력</button>
      </div>

      {tab === 'points' && <PointsTab password={password} />}
      {tab === 'matches' && <MatchesTab password={password} />}
      {tab === 'results' && <ResultsTab password={password} />}
    </div>
  );
}

// ============================================================
// 1. 포인트 지급 탭
// ============================================================
function PointsTab({ password }) {
  const [users, setUsers] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [msg, setMsg] = useState({});
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function giveMePoints(userId) {
    const amount = Number(amounts[userId]);
    setMsg((m) => ({ ...m, [userId]: null }));
    if (!amount) {
      setMsg((m) => ({ ...m, [userId]: { type: 'error', text: '포인트 값을 입력해주세요.' } }));
      return;
    }
    const res = await fetch('/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, userId, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg((m) => ({ ...m, [userId]: { type: 'error', text: data.error } }));
      return;
    }
    setMsg((m) => ({ ...m, [userId]: { type: 'success', text: `완료! 현재 ${data.newPoints}P` } }));
    setAmounts((a) => ({ ...a, [userId]: '' }));
    loadUsers();
  }

  const filtered = users.filter(
    (u) => u.name.includes(search) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        type="text"
        placeholder="이름 또는 이메일 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 14 }}
      />
      {filtered.map((u) => (
        <div className="card" key={u.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <strong>{u.name}</strong>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{u.email}</div>
            </div>
            <span className="points-badge">{u.points}P</span>
          </div>
          <div className="bet-row">
            <input
              type="number"
              placeholder="+100 또는 -100"
              value={amounts[u.id] || ''}
              onChange={(e) => setAmounts((a) => ({ ...a, [u.id]: e.target.value }))}
            />
            <button className="primary" onClick={() => giveMePoints(u.id)}>적용</button>
          </div>
          {msg[u.id] && <p className={`msg ${msg[u.id].type}`}>{msg[u.id].text}</p>}
        </div>
      ))}
      {filtered.length === 0 && <p className="empty">회원이 없습니다.</p>}
    </div>
  );
}

// ============================================================
// 2. 경기 등록 / 수정 탭
// ============================================================
function MatchesTab({ password }) {
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState(null);

  const loadMatches = useCallback(async () => {
    const { data } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
    setMatches(data || []);
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  function updatePlayer(team, index, value) {
    setForm((f) => {
      const key = team === 'A' ? 'players_a' : 'players_b';
      const next = [...f[key]];
      next[index] = value;
      return { ...f, [key]: next };
    });
  }

  function startEdit(m) {
    setForm({
      matchId: m.id,
      title: m.title,
      team_a_name: m.team_a_name,
      team_b_name: m.team_b_name,
      players_a: (m.scores_a || []).map((p) => p.name),
      players_b: (m.scores_b || []).map((p) => p.name),
      odds_a: String(m.odds_a),
      odds_b: String(m.odds_b),
      // datetime-local 입력용 포맷 변환
      deadline: new Date(m.deadline).toISOString().slice(0, 16),
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setForm(emptyForm);
    setMsg(null);
  }

  async function submitForm(e) {
    e.preventDefault();
    setMsg(null);

    const isEdit = !!form.matchId;
    const res = await fetch('/api/matches', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        matchId: form.matchId,
        title: form.title,
        team_a_name: form.team_a_name,
        team_b_name: form.team_b_name,
        players_a: form.players_a,
        players_b: form.players_b,
        odds_a: Number(form.odds_a),
        odds_b: Number(form.odds_b),
        deadline: form.deadline,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: 'error', text: data.error });
      return;
    }
    setMsg({ type: 'success', text: isEdit ? '경기가 수정되었습니다.' : '경기가 등록되었습니다.' });
    setForm(emptyForm);
    loadMatches();
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{form.matchId ? '경기 수정' : '새 경기 등록'}</h3>
        <form onSubmit={submitForm}>
          <div className="form-group">
            <label>경기 제목</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 7월 정기전" />
          </div>

          <div className="form-group">
            <label>A팀 이름</label>
            <input type="text" value={form.team_a_name} onChange={(e) => setForm({ ...form, team_a_name: e.target.value })} placeholder="예: 레드팀" />
          </div>
          <div className="form-group">
            <label>A팀 선수 3명</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {form.players_a.map((p, i) => (
                <input key={i} type="text" value={p} onChange={(e) => updatePlayer('A', i, e.target.value)} placeholder={`선수${i + 1}`} />
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>A팀 배당률</label>
            <input type="text" value={form.odds_a} onChange={(e) => setForm({ ...form, odds_a: e.target.value })} />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' }} />

          <div className="form-group">
            <label>B팀 이름</label>
            <input type="text" value={form.team_b_name} onChange={(e) => setForm({ ...form, team_b_name: e.target.value })} placeholder="예: 블루팀" />
          </div>
          <div className="form-group">
            <label>B팀 선수 3명</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {form.players_b.map((p, i) => (
                <input key={i} type="text" value={p} onChange={(e) => updatePlayer('B', i, e.target.value)} placeholder={`선수${i + 1}`} />
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>B팀 배당률</label>
            <input type="text" value={form.odds_b} onChange={(e) => setForm({ ...form, odds_b: e.target.value })} />
          </div>

          <div className="form-group">
            <label>배팅 마감 시각</label>
            <input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" type="submit" style={{ flex: 1 }}>
              {form.matchId ? '수정 저장' : '경기 등록'}
            </button>
            {form.matchId && <button type="button" className="ghost" onClick={cancelEdit}>취소</button>}
          </div>
          {msg && <p className={`msg ${msg.type}`}>{msg.text}</p>}
        </form>
      </div>

      <h3>등록된 경기</h3>
      {matches.map((m) => (
        <div className="card" key={m.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>{m.title}</strong>
            <span className={`status-tag ${m.status.toLowerCase()}`}>{m.status}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            {m.team_a_name} ({(m.scores_a || []).map((p) => p.name).join(', ')}) vs{' '}
            {m.team_b_name} ({(m.scores_b || []).map((p) => p.name).join(', ')})<br />
            배당 {m.odds_a} / {m.odds_b} · 마감: {new Date(m.deadline).toLocaleString('ko-KR')}
          </p>
          {m.status === 'SETTLED' ? (
            <p className="msg success">정산 완료 ({m.result === 'A' ? m.team_a_name : m.team_b_name} 승)</p>
          ) : (
            <button className="ghost" onClick={() => startEdit(m)}>수정하기</button>
          )}
        </div>
      ))}
      {matches.length === 0 && <p className="empty">등록된 경기가 없습니다.</p>}
    </div>
  );
}

// ============================================================
// 3. 결과 입력 탭 (개인 3게임 점수 → 자동 팀 승패 판정)
// ============================================================
function ResultsTab({ password }) {
  const [matches, setMatches] = useState([]);
  const [scores, setScores] = useState({}); // matchId -> { A: [{name,g1,g2,g3}x3], B: [...] }
  const [msg, setMsg] = useState({});

  const loadMatches = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .neq('status', 'SETTLED')
      .order('deadline', { ascending: true });
    setMatches(data || []);

    const initial = {};
    (data || []).forEach((m) => {
      initial[m.id] = {
        A: (m.scores_a || []).map((p) => ({ ...p })),
        B: (m.scores_b || []).map((p) => ({ ...p })),
      };
    });
    setScores(initial);
  }, []);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  function updateScore(matchId, team, index, game, value) {
    setScores((s) => {
      const next = { ...s };
      const teamArr = [...next[matchId][team]];
      teamArr[index] = { ...teamArr[index], [game]: value === '' ? null : Number(value) };
      next[matchId] = { ...next[matchId], [team]: teamArr };
      return next;
    });
  }

  function teamTotal(players) {
    return (players || []).reduce((sum, p) => sum + (Number(p.g1) || 0) + (Number(p.g2) || 0) + (Number(p.g3) || 0), 0);
  }

  async function submitResult(match) {
    setMsg((m) => ({ ...m, [match.id]: null }));
    if (!confirm('점수를 저장하고 정산하면 되돌릴 수 없습니다. 진행할까요?')) return;

    const res = await fetch('/api/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        matchId: match.id,
        scoresA: scores[match.id].A,
        scoresB: scores[match.id].B,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg((m) => ({ ...m, [match.id]: { type: 'error', text: data.error } }));
      return;
    }
    setMsg((m) => ({ ...m, [match.id]: { type: 'success', text: `정산 완료! ${data.totalA} : ${data.totalB}` } }));
    loadMatches();
  }

  return (
    <div>
      {matches.length === 0 && <p className="empty">결과 입력할 경기가 없습니다.</p>}
      {matches.map((m) => {
        const teamScores = scores[m.id];
        if (!teamScores) return null;
        const totalA = teamTotal(teamScores.A);
        const totalB = teamTotal(teamScores.B);

        return (
          <div className="card" key={m.id}>
            <strong>{m.title}</strong>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              마감: {new Date(m.deadline).toLocaleString('ko-KR')}
            </p>

            {['A', 'B'].map((team) => (
              <div key={team} style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {team === 'A' ? m.team_a_name : m.team_b_name}
                  <span style={{ color: 'var(--accent-2)', fontWeight: 400, marginLeft: 8 }}>
                    합계 {team === 'A' ? totalA : totalB}
                  </span>
                </div>
                {teamScores[team].map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ width: 70, fontSize: 13, color: 'var(--muted)' }}>{p.name}</span>
                    {['g1', 'g2', 'g3'].map((g) => (
                      <input
                        key={g}
                        type="number"
                        placeholder={g.toUpperCase()}
                        value={p[g] ?? ''}
                        onChange={(e) => updateScore(m.id, team, i, g, e.target.value)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}

            <button className="primary" style={{ width: '100%', marginTop: 14 }} onClick={() => submitResult(m)}>
              점수 저장 및 정산
            </button>
            {msg[m.id] && <p className={`msg ${msg[m.id].type}`}>{msg[m.id].text}</p>}
          </div>
        );
      })}
    </div>
  );
}
