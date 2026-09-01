/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing d3 which is ESM-only
  experimental: {
    serverComponentsExternalPackages: ["neo4j-driver", "nodemailer"],
  },
};

module.exports = nextConfig;
