import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, globalThis.process.cwd(), '');
  const isGitHubActions = Boolean(globalThis.process?.env?.GITHUB_ACTIONS);
  const basePath =
    env.VITE_BASE_PATH || (isGitHubActions ? '/Flowbot---IA-integrada/' : '/');

  return {
    plugins: [react()],
    base: basePath,
    server: {
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
  };
});
