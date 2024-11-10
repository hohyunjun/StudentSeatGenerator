/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix:
    process.env.NODE_ENV === "production"
      ? "https://hohyunjun.github.io/StudentSeatGenerator"
      : "",
};

export default nextConfig;
