import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The app uses hash routing (#/trip/<id>), so a relative base works on
// GitHub Pages (https://<user>.github.io/<repo>/) and on any static host.
export default defineConfig({
  base: './',
  plugins: [react()],
});
