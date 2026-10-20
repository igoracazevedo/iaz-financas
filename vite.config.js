import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const fallbackB64 =
    'QVEuQWI4Uk42SlA4RDlCdTZyMUxWQ3VhaHdTNWNnZzRTSzh5SmVZU0pDbzNNY2ZKWGRfLUE=';
  const encodedGeminiKey = env.VITE_GEMINI_API_KEY
    ? Buffer.from(env.VITE_GEMINI_API_KEY).toString('base64')
    : fallbackB64;

  return {
    base: './',
    define: {
      __ENCODED_GEMINI_KEY__: JSON.stringify(encodedGeminiKey),
    },
    plugins: [react(), tailwindcss()],
  };
});
