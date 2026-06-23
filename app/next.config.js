/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 0G storage SDK is node-only; keep it out of the client bundle.
  serverExternalPackages: ["@0gfoundation/0g-storage-ts-sdk", "ethers"],
};
module.exports = nextConfig;
