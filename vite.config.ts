import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // BASE_URL is set in the GitHub Actions deploy workflow.
  // Locally it defaults to '/' which is correct for npm run dev.
  base: process.env.BASE_URL ?? '/',
})
