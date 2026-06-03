import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' so the production build works when loaded from file://
// inside Electron (and on any sub-path host).
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
})
