import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      strict: false,
    },
  },
})
