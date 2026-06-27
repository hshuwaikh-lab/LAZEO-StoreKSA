import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine base path based on deployment platform
// Vercel sets VERCEL=1, otherwise default to GitHub Pages path
const basePath = process.env.VERCEL === '1' ? '/' : '/LAZEO-StoreKSA/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
})
