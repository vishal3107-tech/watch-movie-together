import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills' // <-- Import this

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills(), // <-- Add this to the array
  ],
})