import { createClient } from '@supabase/supabase-js';

// 이 클라이언트는 서버(API route)에서만 사용해야 합니다.
// service_role 키는 RLS를 우회하므로 절대 브라우저에 노출하면 안 됩니다.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
