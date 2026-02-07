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
  // Service worker is now served from API route at /api/firebase-messaging-sw
};

export default nextConfig;