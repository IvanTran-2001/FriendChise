/**
 * Next.js configuration.
 *
 * Remote image patterns: allows `next/image` to serve profile pictures from
 * Google's CDN (`lh3.googleusercontent.com`), which is the source used by
 * Google OAuth avatars.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    turbo: {
      rules: {
        '*.css': {
          loaders: ['@tailwindcss/postcss'],
          as: '*.css',
        },
      },
    },
  },
};

export default nextConfig;