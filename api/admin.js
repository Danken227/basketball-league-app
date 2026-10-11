import { handleAdmin, redisStore } from './_admin.js';

// Funkcja Vercela: /api/admin?action=content|session|login|logout|news-add|news-update|news-delete|team-name-save|team-name-delete|team-logo|records|records-save.
// Logika w _admin.js (wspólna z serwerem Vite), dane w Upstash Redis podpiętym do projektu.
export default async function handler(req, res) {
  try {
    const result = await handleAdmin({
      method: req.method,
      action: String(req.query.action ?? ''),
      query: Object.fromEntries(Object.entries(req.query).map(([key, value]) => [key, String(value)])),
      body: req.body && typeof req.body === 'object' ? req.body : {},
      cookie: req.headers.cookie,
      secure: true,
      store: redisStore(),
    });
    if (result.setCookie) res.setHeader('Set-Cookie', result.setCookie);
    res.setHeader('Cache-Control', result.cacheControl ?? 'no-store');
    if (result.binary) {
      res.setHeader('Content-Type', result.binary.contentType);
      res.status(result.status).send(result.binary.data);
      return;
    }
    res.status(result.status).json(result.body);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
}
