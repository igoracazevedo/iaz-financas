import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const encodedGeminiKey = Buffer.from(env.VITE_GEMINI_API_KEY || '').toString('base64');

  return {
    base: './',
    define: {
      __ENCODED_GEMINI_KEY__: JSON.stringify(encodedGeminiKey),
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
  };
});
