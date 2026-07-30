'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) {
      setError('이름과 이메일을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    // 이미 등록된 이메일인지 확인 (대소문자 구분 없이)
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    let user = existing;

    if (!user) {
      const { data: created, error: insertError } = await supabase
        .from('users')
        .insert({ name: name.trim(), email: normalizedEmail })
        .select()
        .single();

      if (insertError) {
        setError('가입 중 오류가 발생했습니다: ' + insertError.message);
        setLoading(false);
        return;
      }
      user = created;
    }

    localStorage.setItem('toto_user_id', user.id);
    localStorage.setItem('toto_user_name', user.name);
    setLoading(false);
    router.push('/');
  }

  return (
    <div className="container" style={{ maxWidth: 380, paddingTop: 80 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 6 }}>🏆 라온 3인조 토토</h1>
      
      <form onSubmit={handleLogin} className="card">
        <div className="form-group">
          <label>이름</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
        </div>
        <div className="form-group">
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <button className="primary" type="submit" disabled={loading} style={{ width: '100%' }}>
          {loading ? '입장 중...' : '입장하기'}
        </button>
        {error && <p className="msg error">{error}</p>}
      </form>
    </div>
  );
}
