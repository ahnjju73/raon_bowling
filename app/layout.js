import './globals.css';

export const metadata = {
  title: '라온 3인조 토토',
  description: '라온 3인조 전용 포인트 배팅 사이트',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
