import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Public Supabase config — these are safe to embed (anon key is protected by RLS, not secrecy)
const SUPABASE_URL = "https://vanhfllipocroenismcf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhbmhmbGxpcG9jcm9lbmlzbWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3Nzc4NDQsImV4cCI6MjA4NjM1Mzg0NH0.7kgXj-MzYvFEnG-5_WklQKObws4FeDPToikzPnwqFrs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env if present; fall back to the hard-coded public values above
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || SUPABASE_URL
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY
      ),
    },
    server: {
      host: "::",
      port: 8080,
      allowedHosts: true,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt"],
        workbox: {
          navigateFallbackDenylist: [/^\/~oauth/],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
        manifest: {
          name: "StudySwap – Share Study Materials",
          short_name: "StudySwap",
          description:
            "Share knowledge, grow together. Upload and exchange study materials with fellow students.",
          theme_color: "#4a8c6f",
          background_color: "#f7f4ef",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
