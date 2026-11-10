// Short Wikipedia introductions, fetched on demand and cached.
//
// Territory names on the historical maps are English and informal ("Han",
// "Maya chiefdoms and states"), so finding the article takes a few steps:
// a known alias, then the exact title, then Wikipedia's own search.

const ALIASES = {
  Han: 'Han dynasty',
  'Maya chiefdoms and states': 'Maya civilization',
  'Hunters-gatherers': 'Hunter-gatherer',
  'Paleo-Inuit': 'Paleo-Eskimo',
  Rome: 'Ancient Rome',
};

const cache = new Map();

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const api = (lang, params) =>
  getJson(`https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`);

async function intro(lang, title) {
  const page = await getJson(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`,
  );
  if (page.type !== 'standard' || !page.extract) return null;
  return {
    title: page.title,
    text: page.extract,
    image: page.thumbnail?.source ?? null,
    url: page.content_urls.desktop.page,
    lang,
  };
}

/** English title of the article for a map name, plus its title in `lang` if any. */
async function resolve(name, lang) {
  const lookUp = async (title) => {
    const data = await api('en', {
      action: 'query', redirects: '1', titles: title,
      prop: 'pageprops|langlinks', ppprop: 'disambiguation', lllang: lang, lllimit: '1',
    });
    const page = Object.values(data.query?.pages ?? {})[0];
    if (!page || page.missing !== undefined || page.pageprops?.disambiguation !== undefined) return null;
    return { en: page.title, local: page.langlinks?.[0]?.['*'] ?? null };
  };

  const direct = await lookUp(ALIASES[name] ?? name);
  if (direct) return direct;
  const search = await api('en', { action: 'query', list: 'search', srsearch: `${name} history`, srlimit: '1' });
  const hit = search.query?.search?.[0]?.title;
  return hit ? lookUp(hit) : null;
}

/** Introduction for a territory named on a historical map, or null. */
export function introForTerritory(name, lang) {
  const key = `territory|${lang}|${name}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const titles = await resolve(name, lang);
        if (!titles) return null;
        if (lang !== 'en' && titles.local) {
          const local = await intro(lang, titles.local).catch(() => null);
          if (local) return local;
        }
        return intro('en', titles.en);
      })().catch(() => null),
    );
  }
  return cache.get(key);
}

/** Introduction for an article whose title is known in each language. */
export function introForArticle(titles, lang) {
  const key = `article|${lang}|${titles.en}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () =>
        (await intro(lang, titles[lang]).catch(() => null)) ??
        (lang === 'en' ? null : await intro('en', titles.en).catch(() => null)))(),
    );
  }
  return cache.get(key);
}
