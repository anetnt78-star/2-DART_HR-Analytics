/** @type {import("next").NextConfig} */
const nextConfig = {
  // 런타임에 process.cwd() 기준으로 읽는 데이터 파일을 서버리스 번들에 포함한다.
  outputFileTracingIncludes: {
    '/api/**/*': ['./data/corp-index.json', './fixtures/synthetic/**/*'],
  },
};
export default nextConfig;
