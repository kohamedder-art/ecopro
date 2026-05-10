import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    allowedHosts: true,
    watch: {
      ignored: ['**/.env.local', '**/.env.*'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        cookieDomainRewrite: { '*': '' },
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (cookies) {
              proxyRes.headers['set-cookie'] = cookies.map((c: string) =>
                c.replace(/;\s*SameSite=None/gi, '; SameSite=Lax')
                 .replace(/;\s*Secure/gi, '')
              );
            }
          });
        },
      },
      '/robots.txt': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
    fs: {
       allow: [
        path.resolve(__dirname, "client"),
        path.resolve(__dirname, "shared"),
        path.resolve(__dirname) // This allows the root directory
      ],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
    // Raise chunk size warning threshold — we do manual splitting
    chunkSizeWarningLimit: 600,
    // Enable CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // React core — cached long-term, rarely changes
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-core';
          }
          // Router
          if (id.includes('node_modules/react-router')) {
            return 'react-router';
          }
          // Radix UI primitives — many small packages, bundle together
          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-ui';
          }
          // Lucide icons — large icon set
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-icons';
          }
          // NOTE: recharts/D3 intentionally NOT split — circular deps break manual chunking
          // Framer Motion — animation library
          if (id.includes('node_modules/framer-motion')) {
            return 'framer-motion';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack')) {
            return 'tanstack';
          }
          // Algeria geodata — large, only needed for delivery/checkout
          if (id.includes('algeriaGeo') || id.includes('algeria-geo') || id.includes('wilayas')) {
            return 'algeria-geo';
          }
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    // Prevent multiple React copies in the bundle (can cause minified React error #321)
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
