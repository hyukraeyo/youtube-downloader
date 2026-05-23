import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'YTDL Premium - 유튜브 고화질 원본 영상 다운로더',
  description: '유튜브 링크 입력만으로 원본 비디오와 MP3 고음질 오디오를 간편하게 추출할 수 있는 프리미엄 다운로더입니다. 광고 없고 가장 빠른 속도를 경험하세요.',
  keywords: ['유튜브 다운로드', '유튜브 동영상 다운', '유튜브 MP3 변환', '유튜브 고화질 다운', 'ytdl', 'youtube downloader'],
  authors: [{ name: 'Antigravity Premium Dev' }],
  openGraph: {
    title: 'YTDL Premium - 유튜브 고화질 원본 영상 다운로더',
    description: '유튜브 링크 입력만으로 원본 비디오와 MP3 고음질 오디오를 가장 빠르고 깨끗하게 추출하세요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'YTDL Premium',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'YTDL Premium - 유튜브 고화질 원본 영상 다운로더',
    description: '광고 없이 깔끔하게 추출하는 프리미엄 유튜브 원본 동영상 다운로더 서비스.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 웹 애플리케이션 구조 데이터 (JSON-LD SEO 최적화)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'YTDL Premium',
    url: 'https://ytdl-premium.vercel.app', // 임시 주소 혹은 로컬 호스트
    description: '유튜브 동영상 및 오디오 고화질 스트림 다운로드 웹 도구',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows, macOS, Android, iOS',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'KRW',
    },
  };

  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#050505] text-neutral-100 selection:bg-[#FBC02D] selection:text-black">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
