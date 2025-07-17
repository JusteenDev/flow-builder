import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import flowPlugin from './flow/index.js'; // relative import

export default defineConfig({
  plugins: [
    react(),
    flowPlugin()
  ]
});
