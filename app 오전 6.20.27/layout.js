import './globals.css';

export const metadata = {
  title: '동호회 토토',
  description: '동호회 전용 포인트 배팅 사이트',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
