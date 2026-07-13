export function normalizeCompanyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function buildCompanyDirectories(articles = []) {
  const directories = new Map();

  for (const article of articles) {
    if (article.category !== 'companies') continue;
    const name = String(article.companyName || '').trim().replace(/\s+/g, ' ') || 'Company not set';
    const key = normalizeCompanyName(name);
    const directory = directories.get(key) || { key, name, articles: [], featured: false, tags: [], updatedAt: null };
    directory.articles.push(article);
    directory.featured ||= Boolean(article.featured);
    directory.tags = [...new Set([...directory.tags, ...(article.tags || [])])];
    if (!directory.updatedAt || new Date(article.updatedAt) > new Date(directory.updatedAt)) directory.updatedAt = article.updatedAt;
    directories.set(key, directory);
  }

  return [...directories.values()]
    .map((directory) => ({
      ...directory,
      articles: directory.articles.sort(articleOrder),
      draftCount: directory.articles.filter((article) => article.status === 'draft').length,
    }))
    .sort((left, right) => Number(right.featured) - Number(left.featured)
      || new Date(right.updatedAt) - new Date(left.updatedAt)
      || left.name.localeCompare(right.name));
}

export function articleMatchesSearch(article, search) {
  const needle = String(search || '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return [article.title, article.summary, article.content, article.companyName, article.city, article.region, ...(article.tags || [])]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle);
}

function articleOrder(left, right) {
  return Number(right.featured) - Number(left.featured)
    || String(left.status).localeCompare(String(right.status))
    || new Date(right.publishedAt || right.updatedAt) - new Date(left.publishedAt || left.updatedAt);
}
