// Configuration options for Next.js
const nextConfig = {
  reactStrictMode: false, // Enable React strict mode for improved error handling
  swcMinify: true, // Enable SWC minification for improved performance
  compiler: {
    removeConsole:
      process.env.NODE_ENV !== "development"
        ? { exclude: ["error"] }
        : false,
  },
};

// Configuration object tells the next-pwa plugin
const defaultRuntimeCaching = require("next-pwa/cache");
const withPWA = require("next-pwa")({
  dest: "public", // Destination directory for the PWA files
  disable: process.env.NODE_ENV === "development", // Disable PWA in development mode
  register: true, // Register the PWA service worker
  skipWaiting: true, // Skip waiting for service worker activation
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.hostname.endsWith(".supabase.co") &&
        url.pathname.startsWith("/rest/v1/"),
      handler: "NetworkOnly",
      method: "GET",
    },
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        [
          "/api/booking",
          "/api/booking-conflicts",
          "/api/check-in-audit",
        ].includes(url.pathname),
      handler: "NetworkOnly",
      method: "GET",
    },
    ...defaultRuntimeCaching,
  ],
});

// Export the combined configuration for Next.js with PWA support
module.exports = withPWA(nextConfig);
