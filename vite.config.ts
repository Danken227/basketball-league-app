import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5180,
    // Adres do testu osadzania Genius Sports (wpis "127.0.0.1 dev.dalk.pl" w pliku hosts). Zadziała dopiero,
    // gdy Genius dopisze tę domenę do zarejestrowanych dla DALK.
    allowedHosts: ['dev.dalk.pl'],
  },
})
