import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // temp/bin 폴더를 파일 감시에서 제외하여 대용량 파일 생성 시 OOM 방지
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
