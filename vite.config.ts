import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fetchYoutubeFeed } from './api/_youtube.js'
import { fileStore, handleAdmin } from './api/_admin.js'

const snapshotDir = fileURLToPath(new URL('./public/snapshot', import.meta.url))
const adminStoreFile = fileURLToPath(new URL('./data/admin-store.json', import.meta.url))

// Zapis migawki danych Genius do public/snapshot (wersja demonstracyjna poza domeną ligi, geniusSnapshot.ts).
// Pliki wysyła strona /__snapshot (SnapshotCrawler) otwarta na dev.dalk.pl — tylko na serwerze deweloperskim.
function snapshotWriter(): Plugin {
  return {
    name: 'genius-snapshot-writer',
    apply: 'serve',
    configureServer(server) {
      // Lista filmów kanału YouTube ligi — to samo co funkcja Vercela api/youtube-feed.js (zapamiętana na 5 minut).
      let youtubeCache: { at: number; body: string } | undefined
      server.middlewares.use('/api/youtube-feed', async (_req, res) => {
        try {
          if (!youtubeCache || Date.now() - youtubeCache.at > 5 * 60 * 1000) {
            youtubeCache = { at: Date.now(), body: JSON.stringify(await fetchYoutubeFeed()) }
          }
          res.setHeader('content-type', 'application/json')
          res.end(youtubeCache.body)
        } catch (error) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(error) }))
        }
      })
      // Panel administratora — to samo co funkcja Vercela api/admin.js, z zapisem do pliku data/admin-store.json.
      const adminStore = fileStore(adminStoreFile)
      server.middlewares.use('/api/admin', (req, res) => {
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', async () => {
          try {
            const result = await handleAdmin({
              method: req.method,
              action: new URL(req.url ?? '', 'http://localhost').searchParams.get('action') ?? '',
              body: body && req.headers['content-type']?.includes('application/json') ? JSON.parse(body) : {},
              cookie: req.headers.cookie,
              store: adminStore,
            })
            if (result.setCookie) res.setHeader('set-cookie', result.setCookie)
            res.statusCode = result.status
            res.setHeader('content-type', 'application/json')
            res.setHeader('cache-control', 'no-store')
            res.end(JSON.stringify(result.body))
          } catch (error) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(error) }))
          }
        })
      })
      // Pliki migawki prosto z dysku: zapisanych w trakcie pracy serwera Vite nie zna (katalog nie jest
      // obserwowany, żeby zapis nie przeładowywał strony), więc zamiast nich oddałby stronę aplikacji.
      server.middlewares.use('/snapshot', (req, res, nextMiddleware) => {
        const name = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\//, '')
        const file = path.join(snapshotDir, name)
        if (!/^[a-z0-9.]+$/.test(name) || !fs.existsSync(file)) return nextMiddleware()
        const type = name.endsWith('.json') ? 'application/json' : name.endsWith('.css') ? 'text/css' : 'text/html'
        res.setHeader('content-type', `${type}; charset=utf-8`)
        res.setHeader('cache-control', 'no-store')
        res.end(fs.readFileSync(file))
      })
      server.middlewares.use('/__snapshot/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', () => {
          try {
            const { file, key, content } = JSON.parse(body) as { file: string; key: string; content: string }
            if (!/^[a-z0-9]+\.(html|css)$/.test(file)) throw new Error(`Niedozwolona nazwa pliku: ${file}`)
            fs.mkdirSync(snapshotDir, { recursive: true })
            fs.writeFileSync(path.join(snapshotDir, file), content)
            const manifestPath = path.join(snapshotDir, 'index.json')
            const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { files: {} }
            manifest.createdAt = new Date().toISOString()
            manifest.files[file] = key
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1))
            res.setHeader('content-type', 'application/json')
            res.end('{"ok":true}')
          } catch (error) {
            res.statusCode = 400
            res.end(String(error))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Dane logowania administratora (ADMIN_LOGIN, ADMIN_PASSWORD) z .env.local dla api/_admin.js — Vite domyślnie
  // udostępnia zmienne z plików .env tylko stronie (i tylko z przedrostkiem VITE_).
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), 'ADMIN_'))) process.env[key] ??= value
  return {
    plugins: [
      react(),
      tailwindcss(),
      snapshotWriter(),
    ],
    server: {
      port: 5180,
      // Adres do testu osadzania Genius Sports (wpis "127.0.0.1 dev.dalk.pl" w pliku hosts). Zadziała dopiero,
      // gdy Genius dopisze tę domenę do zarejestrowanych dla DALK.
      allowedHosts: ['dev.dalk.pl'],
      // Zapisywanie migawki nie przeładowuje strony, która ją zbiera.
      watch: { ignored: ['**/public/snapshot/**', '**/data/admin-store.json'] },
    },
  }
})
