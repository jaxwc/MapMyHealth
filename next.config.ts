import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Exclude my-mastra-app from compilation
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Exclude my-mastra-app from webpack compilation
    config.module.rules.push({
      test: /my-mastra-app/,
      loader: 'ignore-loader'
    });

    return config;
  },
};

export default nextConfig;
