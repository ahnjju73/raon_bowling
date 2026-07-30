# 동호회 토토 사이트

실제 현금 없이 **포인트**로만 배팅하는 동호회 전용 미니 사이트입니다.
경기는 관리자가 직접 등록하고, 결과 입력 시 자동으로 포인트가 정산됩니다.

---

## 1. Supabase 설정 (DB, 5분)

1. https://supabase.com 가입 → New Project 생성 (무료 티어)
2. 프로젝트 생성 후 좌측 메뉴 **SQL Editor** 클릭
3. 이 폴더의 `supabase-schema.sql` 내용을 그대로 붙여넣고 **Run** 실행
   → users, matches, bets 테이블이 자동 생성됩니다
4. 좌측 메뉴 **Project Settings > API** 로 이동해서 아래 3개 값을 복사해두세요
   - `Project URL`
   - `anon public` 키
   - `service_role` 키 (⚠️ 절대 외부에 노출 금지, 서버에서만 사용)

## 2. 로컬 실행

```bash
npm install
cp .env.local.example .env.local
```

`.env.local` 파일을 열어 위에서 복사한 값들과 원하는 관리자 비밀번호를 채워 넣으세요.

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속 → `/login` 에서 이름/이메일로 입장
→ 처음 가입 시 1000P 자동 지급됩니다.

관리자 페이지는 http://localhost:3000/admin (설정한 ADMIN_PASSWORD로 입장)

## 3. 무료 배포 (Vercel)

1. https://vercel.com 가입 (GitHub 계정으로 로그인 추천)
2. 이 프로젝트를 GitHub 저장소에 올리기
   ```bash
   git init
   git add .
   git commit -m "init"
   # GitHub에서 새 저장소 만든 후
   git remote add origin <저장소 주소>
   git push -u origin main
   ```
3. Vercel 대시보드에서 **Add New Project** → 방금 만든 저장소 선택
4. **Environment Variables** 항목에 `.env.local`에 넣었던 4개 값을 그대로 등록
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
5. **Deploy** 클릭 → 몇 분 뒤 `https://프로젝트명.vercel.app` 주소로 바로 접속 가능

동호회 단톡방에 이 주소만 공유하면 끝입니다. 도메인은 없어도 되고,
나중에 필요하면 가비아 등에서 저렴한 도메인(연 1만원대)을 사서 Vercel에 연결할 수 있어요.

## 4. 사용 흐름

1. **회원**: `/login`에서 이름+이메일 입력 → 자동 가입, 1000P 지급
2. **관리자**: `/admin`에서 비밀번호 입력 → 경기 등록(팀, 배당률, 마감시각)
3. **유저**: 메인 페이지에서 팀 선택 → 포인트 입력 → 배팅
4. **경기 종료 후**: 관리자가 `/admin`에서 승리 팀 선택 → "결과 입력 및 정산" 클릭
   → 적중자에게 (배팅 포인트 × 배당률)만큼 자동 지급

## 5. 참고 / 한계

- 이 구조는 **실제 현금이 오가지 않는 포인트 배팅**을 전제로 만들어졌습니다.
  실제 돈을 걸고 정산하는 방식으로 바꾸면 도박 관련 법 이슈(특히 도박개장죄)가
  생길 수 있으니 유의하세요.
- 로그인은 이메일 확인 없이 이름+이메일만으로 가입되는 간단한 방식입니다.
  악용 우려가 있다면 Supabase Auth(이메일 인증/카카오 로그인)로 교체하는 걸 추천드려요.
- 배당률은 관리자가 경기 등록 시 수동으로 정하는 고정 배당률 방식입니다.
  (베팅에 따라 배당률이 실시간으로 바뀌는 방식이 아님 — 훨씬 단순하고 동호회 규모엔 충분합니다)
