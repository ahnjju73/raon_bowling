'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState({ title: '', team_a: '', team_b: '', odds_a: '1.9', odds_b: '1.9', deadline: '' });
  const [msg, setMsg] = useState(null);
  const [resultChoice, setResultChoice] = useState({});

  const loadMatches = useCallback(async () => {
    const { data } = await supabase.from('matches').select('*').order('created_at', { ascending: false });
    setMatches(data || []);
  }, []);

  useEffect(() => {
    if (unlocked) loadMatches();
  }, [unlocked, loadMatches]);

  async function createMatch(e) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, ...form, odds_a: Number(form.odds_a), odds_b: Number(form.odds_b) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ type: 'error', text: data.error });
      return;
    }
    setMsg({ type: 'success', text: '경기가 등록되었습니다.' });
    setForm({ title: '', team_a: '', team_b: '', odds_a: '1.9', odds_b: '1.9', deadline: '' });
    loadMatches();
  }

  async function settleMatch(matchId) {
    const result = resultChoice[matchId];
    if (!result) {
      alert('승리 팀을 선택해주세요.');
      return;
    }
    if (!confirm('정산하면 되돌릴 수 없습니다. 진행할까요?')) return;

    const res = await fetch('/api/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, matchId, result }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert('오류: ' + data.error);
      return;
    }
    alert(`정산 완료 (${data.settledCount}건)`);
    loadMatches();
  }

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
      <h1>⚙️ 경기 관리</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>새 경기 등록</h3>
        <form onSubmit={createMatch}>
          <div className="form-group">
            <label>경기 제목</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 7월 정기전" />
          </div>
          <div className="form-group">
            <label>팀 A</label>
            <input type="text" value={form.team_a} onChange={(e) => setForm({ ...form, team_a: e.target.value })} />
          </div>
          <div className="form-group">
            <label>팀 A 배당률</label>
            <input type="text" value={form.odds_a} onChange={(e) => setForm({ ...form, odds_a: e.target.value })} />
          </div>
          <div className="form-group">
            <label>팀 B</label>
            <input type="text" value={form.team_b} onChange={(e) => setForm({ ...form, team_b: e.target.value })} />
          </div>
          <div className="form-group">
            <label>팀 B 배당률</label>
            <input type="text" value={form.odds_b} onChange={(e) => setForm({ ...form, odds_b: e.target.value })} />
          </div>
          <div className="form-group">
            <label>배팅 마감 시각</label>
            <input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <button className="primary" type="submit" style={{ width: '100%' }}>경기 등록</button>
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
            {m.team_a} ({m.odds_a}) vs {m.team_b} ({m.odds_b})<br />
            마감: {new Date(m.deadline).toLocaleString('ko-KR')}
          </p>

          {m.status === 'SETTLED' ? (
            <p className="msg success">결과: {m.result === 'A' ? m.team_a : m.team_b} 승리</p>
          ) : (
            <div className="bet-row">
              <select
                style={{ flex: 1, background: '#0f1420', color: '#eef1f7', border: '1px solid var(--border)', borderRadius: 8, padding: '10px' }}
                value={resultChoice[m.id] || ''}
                onChange={(e) => setResultChoice((r) => ({ ...r, [m.id]: e.target.value }))}
              >
                <option value="">승리 팀 선택</option>
                <option value="A">{m.team_a}</option>
                <option value="B">{m.team_b}</option>
              </select>
              <button className="primary" onClick={() => settleMatch(m.id)}>결과 입력 및 정산</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
