export function normalizeCompanyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function buildCompanyDirectories(articles = []) {
  const directories = new Map();

  for (const article of articles) {
    if (article.category !== 'companies') continue;
    const name = String(article.companyName || '').trim().replace(/\s+/g, ' ') || 'Company not set';
    const key = normalizeCompanyName(name);
    const directory = directories.get(key) || { key, name, articles: [], featured: false, tags: [], updatedAt: null, companyWebsite: '', companyLogoUrl: '' };
    directory.articles.push(article);
    directory.featured ||= Boolean(article.featured);
    directory.tags = [...new Set([...directory.tags, ...(article.tags || [])])];
    if (!directory.updatedAt || new Date(article.updatedAt) > new Date(directory.updatedAt)) directory.updatedAt = article.updatedAt;
    if (article.companyWebsite && (!directory.websiteUpdatedAt || new Date(article.updatedAt) > new Date(directory.websiteUpdatedAt))) {
      directory.companyWebsite = article.companyWebsite;
      directory.websiteUpdatedAt = article.updatedAt;
    }
    if (article.companyLogoUrl && (!directory.logoUpdatedAt || new Date(article.updatedAt) > new Date(directory.logoUpdatedAt))) {
      directory.companyLogoUrl = article.companyLogoUrl;
      directory.logoUpdatedAt = article.updatedAt;
    }
    directories.set(key, directory);
  }

  return [...directories.values()]
    .map(directoryForDisplay)
    .sort((left, right) => Number(right.featured) - Number(left.featured)
      || new Date(right.updatedAt) - new Date(left.updatedAt)
      || left.name.localeCompare(right.name));
}

export function articleMatchesSearch(article, search) {
  const needle = String(search || '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return [article.title, article.summary, article.content, article.companyName, article.companyWebsite, article.city, article.region, ...(article.tags || [])]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle);
}

function directoryForDisplay(directory) {
  const result = {
    ...directory,
    articles: directory.articles.sort(articleOrder),
    draftCount: directory.articles.filter((article) => article.status === 'draft').length,
  };
  delete result.websiteUpdatedAt;
  delete result.logoUpdatedAt;
  return result;
}

function articleOrder(left, right) {
  return Number(right.featured) - Number(left.featured)
    || String(left.status).localeCompare(String(right.status))
    || new Date(right.publishedAt || right.updatedAt) - new Date(left.publishedAt || left.updatedAt);
}
