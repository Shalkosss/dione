import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En dev: /api/candles/VOO?... → https://query1.finance.yahoo.com/v8/finance/chart/VOO?...
      // En prod: Vercel serverless function en /api/candles/[ticker].js hace lo mismo.
      '/api/candles': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/candles', '/v8/finance/chart'),
      },
    },
  },
});
