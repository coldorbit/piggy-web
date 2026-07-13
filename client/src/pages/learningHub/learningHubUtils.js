export function normalizeCompanyName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function buildCompanyDirectories(companies = [], articles = []) {
  const companyArticles = new Map();
  for (const article of articles) {
    if (article.category !== 'companies' || !article.companyId) continue;
    const id = String(article.companyId);
    const grouped = companyArticles.get(id) || [];
    grouped.push(article);
    companyArticles.set(id, grouped);
  }

  return companies.map((company) => {
    const groupedArticles = (companyArticles.get(String(company.id)) || []).sort(articleOrder);
    const articleUpdatedAt = groupedArticles.reduce((latest, article) => newerDate(latest, article.updatedAt), null);
    return {
      id: String(company.id),
      key: company.slug,
      slug: company.slug,
      name: company.name,
      description: company.description || '',
      companyWebsite: company.website || '',
      companyLogoUrl: company.logoUrl || '',
      industry: company.industry || '',
      headquarters: company.headquarters || '',
      articles: groupedArticles,
      featured: groupedArticles.some((article) => article.featured),
      tags: [...new Set(groupedArticles.flatMap((article) => article.tags || []))],
      draftCount: groupedArticles.filter((article) => article.status === 'draft').length,
      updatedAt: newerDate(company.updatedAt, articleUpdatedAt),
    };
  }).sort((left, right) => Number(right.featured) - Number(left.featured)
    || new Date(right.updatedAt) - new Date(left.updatedAt)
    || left.name.localeCompare(right.name));
}

export function articleMatchesSearch(article, search) {
  const needle = String(search || '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return [article.title, article.summary, article.content, article.companyName, article.companyWebsite, article.city, article.region, ...(article.tags || [])]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle);
}

export function directoryMatchesSearch(directory, search) {
  const needle = String(search || '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return [directory.name, directory.description, directory.companyWebsite, directory.industry, directory.headquarters, ...directory.tags]
    .filter(Boolean).join(' ').toLocaleLowerCase().includes(needle)
    || directory.articles.some((article) => articleMatchesSearch(article, search));
}

function newerDate(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  return new Date(right) > new Date(left) ? right : left;
}

function articleOrder(left, right) {
  return Number(right.featured) - Number(left.featured)
    || String(left.status).localeCompare(String(right.status))
    || new Date(right.publishedAt || right.updatedAt) - new Date(left.publishedAt || left.updatedAt);
}
