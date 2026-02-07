/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", 
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com", 
      },
    ],
  },
  // Service worker headers are now handled by the API route
  // No additional headers configuration needed here
};

export default nextConfig;