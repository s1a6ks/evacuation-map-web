import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// https://vite.dev/config/
export default defineConfig({
  base: '/evacuation-map-web/', // Це обов'язково для GitHub Pages
  plugins: [react()],
})