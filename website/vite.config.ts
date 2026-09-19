import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves this project at /squadron-terminal/ (a subpath);
// Vercel (and Vite's own local dev/preview) serve it from the domain root.
// Vercel sets the VERCEL env var during its builds, so that's what
// distinguishes the two without needing a separate config file.
const base = process.env.VERCEL ? '/' : '/squadron-terminal/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
})
