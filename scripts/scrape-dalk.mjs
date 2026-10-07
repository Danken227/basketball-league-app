// Pobiera 20 ostatnich aktualności i regulamin z dalk.pl do plików JSON: node scripts/scrape-dalk.mjs src/data
// Strony otwieramy w przeglądarce, bo adresy e-mail Joomla wstawia skryptem dopiero po załadowaniu strony.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// Playwright nie jest zależnością projektu — bierzemy go z lokalnej instalacji (ścieżka w PLAYWRIGHT_HOME).
const require = createRequire(`${process.env.PLAYWRIGHT_HOME ?? 'D:/Tools/MCP/mcp-playwright'}/package.json`);
const { chromium } = require('playwright');

const outDir = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();

// Pomocnicze funkcje dostępne na każdej stronie (window.dalk).
await page.addInitScript(() => {
  const abs = (url) => new URL(url, 'https://dalk.pl/').href;
  const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const attr = (text) => esc(text).replace(/"/g, '&quot;');
  // Czysty HTML: bez stylów i znaczników z Worda, tylko akapity, pogrubienia, linki, listy, tabele i obrazy.
  const blockTags = { P: 'p', UL: 'ul', OL: 'ol', LI: 'li', TABLE: 'table', THEAD: 'thead', TBODY: 'tbody', TR: 'tr', TD: 'td', TH: 'th', H1: 'h3', H2: 'h3', H3: 'h3', H4: 'h4', H5: 'h4', H6: 'h4', BLOCKQUOTE: 'blockquote' };
  const inlineTags = { B: 'strong', STRONG: 'strong', I: 'em', EM: 'em' };
  const image = (img) => {
    const src = img.getAttribute('data-gridbox-lazyload-src') || img.getAttribute('src');
    return src && !src.includes('default-lazy-load') ? `<img src="${attr(abs(src))}" alt="${attr(img.getAttribute('alt') || '')}">` : '';
  };
  const clean = (node) =>
    [...node.childNodes]
      .map((child) => {
        if (child.nodeType === Node.TEXT_NODE) return esc(child.textContent.replace(/\u00a0/g, ' '));
        if (child.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = child.tagName;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return '';
        if (tag === 'BR') return '<br>';
        if (tag === 'IMG') return image(child);
        const inner = clean(child);
        if (tag === 'A' && child.getAttribute('href')) return `<a href="${attr(abs(child.getAttribute('href')))}">${inner}</a>`;
        const name = blockTags[tag] || inlineTags[tag];
        if (!name) return inner;
        if (inlineTags[tag] && !inner.trim()) return inner;
        return `<${name}>${inner}</${name}>`;
      })
      .join('');
  // Puste akapity (odstępy wstawiane Enterem) i <br> na końcu akapitów — odstępy daje styl strony.
  const tidy = (html) =>
    html
      .replace(/(<br>\s*)+<\/p>/g, '</p>')
      .replace(/<p>(\s|<br>)*<\/p>/g, '')
      .replace(/<strong>(\s*)<\/strong>/g, '$1')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .trim();
  window.dalk = { abs, clean, tidy, image };
});

const months = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const isoDate = (text) => {
  const [day, month, year] = text.trim().split(/\s+/);
  return `${year}-${String(months.indexOf(month.toLowerCase()) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const links = [];
for (const pageNo of [1, 2]) {
  await page.goto(`https://dalk.pl/aktualnosci-2-2/aktualnosci.html?page=${pageNo}`, { waitUntil: 'load' });
  links.push(...(await page.$$eval('.ba-item-blog-posts .ba-blog-post h3 a', (anchors) => anchors.map((a) => a.href))));
}

const news = [];
for (const href of links) {
  await page.goto(href, { waitUntil: 'load' });
  const post = await page.evaluate(() => {
    const { clean, tidy, image } = window.dalk;
    const wrapper = document.querySelector('.blog-content-wrapper');
    const parts = [...wrapper.querySelectorAll('.ba-item')].map((item) => {
      if (item.classList.contains('ba-item-text')) return clean(item.querySelector('.content-text') ?? item);
      if (item.classList.contains('ba-item-image')) {
        const img = item.querySelector('img');
        return img ? `<p>${image(img)}</p>` : '';
      }
      return '';
    });
    const title = document.querySelector('.intro-post-title').textContent.trim();
    const holder = document.createElement('div');
    holder.innerHTML = tidy(parts.join('\n'));
    // Treść wpisów często zaczyna się akapitem powtarzającym tytuł — na naszej stronie tytuł jest nad treścią.
    const plain = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const first = holder.firstElementChild;
    if (first?.tagName === 'P' && plain(first.textContent) === plain(title)) first.remove();
    const html = holder.innerHTML.trim();
    // Tekst zajawki: końce linii i akapitów jako spacje, żeby słowa z sąsiednich linii się nie sklejały.
    const textHolder = document.createElement('div');
    textHolder.innerHTML = html.replace(/<br>|<\/(p|li|h3|h4|td)>/g, ' $&');
    return {
      title,
      date: document.querySelector('.intro-post-date').textContent,
      image: document.querySelector('meta[property="og:image"]')?.content,
      text: textHolder.textContent.replace(/\s+/g, ' ').trim(),
      html,
    };
  });
  const { text, ...rest } = post;
  news.push({
    slug: href.split('/').pop().replace(/\.html$/, ''),
    ...rest,
    date: isoDate(post.date),
    excerpt: text.length > 220 ? `${text.slice(0, 220).replace(/\s+\S*$/, '')}…` : text,
    source: href,
  });
}

// Regulamin: sekcje (pogrubione nagłówki "1. Organizator") z punktami.
await page.goto('https://dalk.pl/fiba/regulamin.html', { waitUntil: 'load' });
const paragraphs = await page.evaluate(() => {
  const { clean, tidy } = window.dalk;
  const content = [...document.querySelectorAll('.ba-item-text')].find((item) => item.textContent.length > 10000).querySelector('.content-text');
  return [...content.children].map((p) => ({
    text: p.textContent.replace(/\s+/g, ' ').trim(),
    bold: [...p.querySelectorAll('b, strong')].map((b) => b.textContent).join('').replace(/\s+/g, ' ').trim(),
    style: p.getAttribute('style') || '',
    html: tidy(clean(p)).replace(/^<p>|<\/p>$/g, '').replace(/\s+/g, ' ').trim(),
  }));
});
await browser.close();

// Numeracja punktów jest w tekście (z Worda). Podpunkty: litery (a., b.), druga pozycja listy Worda albo wcięcie.
// Akapity bez numeru dopisujemy do poprzedniego punktu.
const sections = [];
for (const p of paragraphs) {
  if (!p.text || p.text === 'REGULAMIN') continue;
  if (p.bold.length >= p.text.length - 4 && /^\d+\.\s/.test(p.text)) {
    const [, label, title] = p.text.match(/^(\d+)\.\s+(.*)$/);
    sections.push({ label, title, items: [] });
    continue;
  }
  const numbered = p.html.match(/^((?:<[^>]+>)*)\s*(\d+|[a-z])\.\s+/);
  const items = sections.at(-1).items;
  if (!numbered) {
    items.at(-1).html += `<br>${p.html}`;
    continue;
  }
  const indent = Number(p.style.match(/margin-left:\s*(-?[\d.]+)in/)?.[1] ?? 0);
  const sub = /^[a-z]$/.test(numbered[2]) || /level[2-9]/.test(p.style) || indent >= 0.3;
  items.push({ level: sub ? 2 : 1, label: numbered[2], html: p.html.replace(numbered[0], numbered[1]) });
}

// Adresy e-mail (po odkryciu przez skrypt Joomli zwykły tekst) jako linki mailto.
const mailto = (html) => html.replace(/(^|[\s>(:])([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g, '$1<a href="mailto:$2">$2</a>');
for (const post of news) post.html = mailto(post.html);
for (const section of sections) for (const item of section.items) item.html = mailto(item.html);

fs.writeFileSync(path.join(outDir, 'dalkNews.json'), `${JSON.stringify(news, null, 1)}\n`);
fs.writeFileSync(path.join(outDir, 'dalkRegulations.json'), `${JSON.stringify(sections, null, 1)}\n`);
console.log(news.length, 'aktualności;', sections.length, 'sekcji regulaminu,', sections.reduce((n, s) => n + s.items.length, 0), 'punktów');
