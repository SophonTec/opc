import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // A stray package-lock.json in a parent directory makes Next infer the wrong
  // workspace root. Pin it to this project so dev/build resolve correctly.
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
