import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fetchYoutubeFeed } from './api/_youtube.js'
import { fileStore, handleAdmin } from './api/_admin.js'

// Klient (liga), dla którego budujemy stronę: clients/<CLIENT> (domyślnie dalk). Jego public/ to pliki strony
// (logo, banery, migawka demo), site.json — tytuł, ikona i adres deweloperski, a reszta konfiguracji jest
// dostępna w kodzie strony jako @client (clients/<klient>/client.ts).
const clientId = process.env.CLIENT ?? 'dalk'
const clientDir = fileURLToPath(new URL(`./clients/${clientId}`, import.meta.url))
const clientSite = JSON.parse(fs.readFileSync(path.join(clientDir, 'site.json'), 'utf8')) as { title: string; favicon: string; devHost: string }
const snapshotDir = path.join(clientDir, 'public', 'snapshot')

// Tytuł i ikona klienta w index.html (%CLIENT_TITLE%, %CLIENT_FAVICON%).
function clientHtml(): Plugin {
  return {
    name: 'client-html',
    transformIndexHtml: (html) => html.replaceAll('%CLIENT_TITLE%', clientSite.title).replaceAll('%CLIENT_FAVICON%', clientSite.favicon),
  }
}
const adminStoreFile = fileURLToPath(new URL('./data/admin-store.json', import.meta.url))

// Zapis migawki danych Genius do clients/<klient>/public/snapshot (wersja demonstracyjna poza domeną ligi, geniusSnapshot.ts).
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
      // Zmiana kodu serwera (api/) wymaga restartu — Vite nie zawsze wczytuje ponownie moduły importowane przez
      // konfigurację, a stary kod panelu odrzucał potem zapisy (np. "Nieprawidłowa data." po zmianie formularza).
      server.watcher.add(fileURLToPath(new URL('./api', import.meta.url)))
      server.watcher.on('change', (file) => {
        if (/[\\/]api[\\/][^\\/]+\.js$/.test(file)) server.restart()
      })
      // Panel administratora — to samo co funkcja Vercela api/admin.js, z zapisem do pliku data/admin-store.json.
      const adminStore = fileStore(adminStoreFile)
      server.middlewares.use('/api/admin', (req, res) => {
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk: string) => (body += chunk))
        req.on('end', async () => {
          try {
            const params = new URL(req.url ?? '', 'http://localhost').searchParams
            const result = await handleAdmin({
              method: req.method,
              action: params.get('action') ?? '',
              query: Object.fromEntries(params),
              body: body && req.headers['content-type']?.includes('application/json') ? JSON.parse(body) : {},
              cookie: req.headers.cookie,
              store: adminStore,
            })
            if (result.setCookie) res.setHeader('set-cookie', result.setCookie)
            res.statusCode = result.status
            res.setHeader('cache-control', result.cacheControl ?? 'no-store')
            if (result.binary) {
              res.setHeader('content-type', result.binary.contentType)
              if (result.binary.disposition) res.setHeader('content-disposition', result.binary.disposition)
              res.end(result.binary.data)
              return
            }
            if (result.body === undefined) {
              res.end()
              return
            }
            res.setHeader('content-type', 'application/json')
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
      // Listy zamkniętych edycji (strona /__indeks, HistoryIndexBuilder) → clients/<klient>/public/genius-history.json.
      server.middlewares.use('/__genius-history/save', (req, res) => {
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
            const file = JSON.parse(body) as { lists: Record<string, string[]> }
            if (!file.lists || Object.keys(file.lists).length === 0) throw new Error('Pusty plik list')
            const json = JSON.stringify(file)
            fs.writeFileSync(path.join(clientDir, 'public', 'genius-history.json'), json)
            res.end(`${Math.round(json.length / 1024)} KB`)
          } catch (error) {
            res.statusCode = 400
            res.end(String(error))
          }
        })
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

// Build wersji demonstracyjnej: pliki migawki w dist/snapshot kompresujemy gzipem (<plik>.html.gz, manifest
// z gzip: true, rozpakowuje je geniusSnapshot.ts). Cała migawka to ok. 300 MB HTML, a wdrożenie z CLI Vercela
// (plan Hobby) mieści najwyżej 100 MB; po kompresji jest ok. 10 razy mniejsza.
function snapshotCompressor(): Plugin {
  let outDir = ''
  return {
    name: 'genius-snapshot-compressor',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const dir = path.join(outDir, 'snapshot')
      const manifestPath = path.join(dir, 'index.json')
      if (!fs.existsSync(manifestPath)) return
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      for (const file of Object.keys(manifest.files)) {
        const source = path.join(dir, file)
        if (!fs.existsSync(source)) continue
        fs.writeFileSync(`${source}.gz`, zlib.gzipSync(fs.readFileSync(source), { level: 9 }))
        fs.rmSync(source)
      }
      manifest.gzip = true
      fs.writeFileSync(manifestPath, JSON.stringify(manifest))
    },
  }
}

// Data zapisu migawki (pasek wersji demonstracyjnej) — wpisana w build, żeby pasek od razu miał docelowy tekst.
function snapshotCreatedAt() {
  try {
    return (JSON.parse(fs.readFileSync(path.join(snapshotDir, 'index.json'), 'utf8')) as { createdAt?: string }).createdAt ?? ''
  } catch {
    return ''
  }
}

// Lista aktualności bez treści wpisów: import "…/news.json?summary" daje wpisy bez pola html. Listy i strona
// główna potrzebują tylko tytułu, zajawki i okładki, a pełny plik (ok. 130 KB) wczytuje dopiero strona wpisu.
function newsSummary(): Plugin {
  const suffix = '?summary'
  return {
    name: 'news-summary',
    enforce: 'pre',
    // Filtry: hooki działają tylko dla tych importów, a nie dla każdego modułu strony.
    resolveId: {
      filter: { id: /\?summary$/ },
      async handler(id, importer) {
        const resolved = await this.resolve(id.slice(0, -suffix.length), importer)
        return resolved && `\0${resolved.id}${suffix}`
      },
    },
    load: {
      filter: { id: /^\0.*\?summary$/ },
      handler(id) {
        const file = id.slice(1, -suffix.length)
        this.addWatchFile(file)
        const items = JSON.parse(fs.readFileSync(file, 'utf8')) as { html?: string }[]
        for (const item of items) delete item.html
        return `export default ${JSON.stringify(items)}`
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  // Dane logowania administratora (ADMIN_LOGIN, ADMIN_PASSWORD) z .env.local dla api/_admin.js — Vite domyślnie
  // udostępnia zmienne z plików .env tylko stronie (i tylko z przedrostkiem VITE_).
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), 'ADMIN_'))) process.env[key] ??= value
  const snapshot = loadEnv(mode, process.cwd(), 'VITE_').VITE_DATA_SOURCE === 'snapshot'
  return {
    plugins: [
      react(),
      tailwindcss(),
      snapshotWriter(),
      snapshotCompressor(),
      clientHtml(),
      newsSummary(),
    ],
    define: { 'import.meta.env.VITE_SNAPSHOT_CREATED_AT': JSON.stringify(snapshot ? snapshotCreatedAt() : '') },
    publicDir: path.join(clientDir, 'public'),
    resolve: { alias: { '@client': clientDir } },
    server: {
      port: 5180,
      // Adres deweloperski w domenie ligi (np. wpis "127.0.0.1 dev.dalk.pl" w pliku hosts) — Genius wydaje dane
      // tylko domenom zarejestrowanym dla organizacji.
      allowedHosts: [clientSite.devHost],
      // Zapisywanie migawki nie przeładowuje strony, która ją zbiera.
      watch: { ignored: ['**/public/snapshot/**', '**/data/admin-store.json'] },
    },
  }
})
