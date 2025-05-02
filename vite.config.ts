import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/barbated/', // Add this line for GitHub Pages
  plugins: [react()],
})
