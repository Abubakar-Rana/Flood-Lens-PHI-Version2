import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 17 MB of TopoJSON/GeoJSON in /public/web-data/ is served as static assets.
  // Excluding it from server file-tracing speeds up builds and prevents the
  // bundler from scanning every district file.
  outputFileTracingExcludes: {
    "*": [
      "./public/web-data/**/*",
      "./public/Boundries/**/*",
      "./public/Data/**/*",
    ],
  },
};

export default nextConfig;
