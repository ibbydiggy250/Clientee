import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` is a Node-only package; keep it out of the client bundle.
  serverExternalPackages: ["pg"],
  // Tell Next.js the project starts here. Without this it picks up a stray
  // package-lock.json further up the folder tree and warns about it.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
