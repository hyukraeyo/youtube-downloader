import type { Metadata } from 'next';
import { Inter, Noto_Sans_KR } from 'next/font/google';
import './globals.css';

// 고해상도 영문 Inter 폰트와 한글 Noto Sans KR 폰트를 결합한 초프리미엄 폰트 시스템 구축
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-noto-sans-kr',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CutTube AI - 유튜브 고화질 원본 다운로더 & AI 쇼츠 메이커',
  description: '유튜브 링크 입력만으로 원본 비디오와 MP3 고음질 오디오를 다운로드하고, Gemini AI를 통해 바이럴 가능성이 높은 쇼츠 구간을 자동으로 추출 및 편집하는 프리미엄 서비스입니다.',
  keywords: ['유튜브 다운로드', '유튜브 동영상 다운', '유튜브 MP3 변환', '유튜브 고화질 다운', '쇼츠 제작', 'AI 쇼츠', 'CutTube AI', 'ytdl'],
  authors: [{ name: 'CutTube AI Premium Dev' }],
  openGraph: {
    title: 'CutTube AI - 유튜브 고화질 원본 다운로더 & AI 쇼츠 메이커',
    description: '원본 비디오 및 오디오 고화질 추출부터 Gemini AI 스마트 쇼츠 자동 편집까지 간편하게 해결하세요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'CutTube AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CutTube AI - 유튜브 고화질 원본 다운로더 & AI 쇼츠 메이커',
    description: 'Gemini AI로 바이럴 쇼츠를 즉시 추출하는 프리미엄 유튜브 원본 동영상 다운로더 서비스.',
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
    name: 'CutTube AI',
    url: 'https://cuttube-ai.vercel.app', // 임시 주소 혹은 로컬 호스트
    description: '유튜브 동영상 다운로드 및 AI 기반 쇼츠 세그먼트 분석/추출 웹 도구',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Windows, macOS, Android, iOS',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'KRW',
    },
  };

  // SSR 단계에서 다크모드 깜빡임을 완벽 방지하는 주입형 미세 인라인 스크립트
  const themeThemeRestoreScript = `
    (function() {
      try {
        var theme = localStorage.getItem('cuttube_theme');
        if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      } catch (e) {}
    })();
  `;

  return (
    <html lang="ko" className="h-full antialiased dark font-sans" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeThemeRestoreScript }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${notoSansKr.variable} min-h-full flex flex-col bg-background text-foreground transition-colors duration-300 selection:bg-primary selection:text-white`}>
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}

