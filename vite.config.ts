import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, PluginOption } from "vite";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
const resolvedPort = Number(process.env.PORT || process.env.VITE_PORT) || 3700;

export default defineConfig({
  server: {
    host: process.env.VITE_HOST || '0.0.0.0',
    port: resolvedPort,
    strictPort: true,
    allowedHosts: ['10xmindplay.mothilal.dev', 'localhost'],
    hmr: {
      clientPort: 443,
      protocol: 'wss',
      host: '10xmindplay.mothilal.dev',
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE
    createIconImportProxy() as PluginOption,
    sparkPlugin({ port: resolvedPort }) as PluginOption,
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
