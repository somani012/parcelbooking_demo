/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
    serverActions: { bodySizeLimit: "4mb" },
  },
};
export default nextConfig;
