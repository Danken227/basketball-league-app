// Lista aktualności bez treści wpisów (plugin newsSummary w vite.config.ts).
declare module '*/news.json?summary' {
  const items: { slug: string; title: string; date: string; excerpt: string; image: string; source: string }[];
  export default items;
}
