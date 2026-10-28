import type { NextConfig } from "next";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  // shown in Help > Check for updates / About
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  // the library folder is read at runtime (KIT_LIBRARY_DIR), never bundled
  outputFileTracingExcludes: {
    '*': ['tools/**', 'library/**', 'docs/**', 'scripts/**', 'public/**', 'release/**', 'electron/**', '*.zip', '*.rar'],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    // Don't watch heavy non-app folders (Blender portable, scripts, docs) - keeps dev start/compile fast
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules/**", "**/.git/**", "**/tools/**", "**/scripts/**", "**/docs/**"],
    };
    return config;
  },
};

export default nextConfig;
