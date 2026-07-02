import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom domains should be served from root.
const basePath = '/'

export default defineConfig({
  plugins: [react()],
  base: basePath,
})
