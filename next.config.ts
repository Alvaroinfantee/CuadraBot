import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/es",
        destination: "/",
        permanent: true,
      },
      {
        source: "/flooring-takeoff",
        destination: "/fixture-takeoff",
        permanent: true,
      },
      {
        source: "/drywall-takeoff",
        destination: "/",
        permanent: true,
      },
      {
        source: "/door-window-takeoff",
        destination: "/fixture-takeoff",
        permanent: true,
      },
      {
        source: "/es/flooring-takeoff",
        destination: "/es/fixture-takeoff",
        permanent: true,
      },
      {
        source: "/es/drywall-takeoff",
        destination: "/",
        permanent: true,
      },
      {
        source: "/es/door-window-takeoff",
        destination: "/es/fixture-takeoff",
        permanent: true,
      },
      {
        source: "/order",
        destination: "/pedido",
        permanent: false,
      },
      {
        source: "/es/order",
        destination: "/pedido",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
};

export default nextConfig;
