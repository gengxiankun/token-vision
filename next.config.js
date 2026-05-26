/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/token-vision',
  assetPrefix: '/token-vision/',
  images: { unoptimized: true },
  trailingSlash: true,
}

module.exports = nextConfig
