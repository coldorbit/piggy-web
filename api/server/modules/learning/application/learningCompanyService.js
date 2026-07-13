import { Op } from 'sequelize';
import { getLearningArticleModel, getLearningCompanyModel } from '../../../../db.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { clean } from '../../../utils/index.js';
import { isAdminRole } from '../../../utils/roles.js';

export async function listLearningCompaniesForUser(user) {
  const companies = await getLearningCompanyModel().findAll({ order: [['name', 'ASC']] });
  const articleWhere = isAdminRole(user) ? { category: 'companies' } : { category: 'companies', status: 'published' };
  const articles = await getLearningArticleModel().findAll({ attributes: ['companyId'], where: articleWhere, raw: true });
  const articleCounts = articles.reduce((counts, article) => {
    const id = String(article.companyId || '');
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map());
  return companies.map((company) => publicLearningCompany(company, articleCounts.get(String(company.id)) || 0));
}

export async function createLearningCompany({ body, user }) {
  const attrs = learningCompanyAttributesFromBody(body);
  const existing = await getLearningCompanyModel().findOne({ where: { [Op.or]: [{ slug: attrs.slug }, { name: { [Op.iLike]: attrs.name } }] } });
  if (existing) throw new InputError('A company with that name already exists');
  const company = await getLearningCompanyModel().create({ ...attrs, createdByUserId: user?.id || null });
  return publicLearningCompany(company, 0);
}

export async function updateLearningCompany({ id, body }) {
  const company = await getLearningCompanyModel().findByPk(id);
  if (!company) throw new NotFoundError('Learning company not found');
  const attrs = learningCompanyAttributesFromBody(body, company);
  const duplicate = await getLearningCompanyModel().findOne({ where: { id: { [Op.ne]: id }, name: { [Op.iLike]: attrs.name } } });
  if (duplicate) throw new InputError('A company with that name already exists');
  await company.update(attrs);
  await getLearningArticleModel().update(
    { companyName: company.name, companyWebsite: company.website, companyLogoUrl: company.logoUrl },
    { where: { companyId: company.id } },
  );
  return publicLearningCompany(company);
}

export function learningCompanyAttributesFromBody(body = {}, current = {}) {
  const name = boundedText(body.name ?? current.name, 'Company name', 240, true);
  return {
    slug: current.slug || learningCompanySlug(name),
    name,
    description: boundedText(body.description ?? current.description, 'Company description', 2_000, true),
    website: httpUrl(body.website ?? current.website, 'Company website'),
    logoUrl: httpUrl(body.logoUrl ?? current.logoUrl, 'Company logo'),
    industry: boundedText(body.industry ?? current.industry, 'Industry', 240),
    headquarters: boundedText(body.headquarters ?? current.headquarters, 'Headquarters', 240),
  };
}

export function publicLearningCompany(company, articleCount = undefined) {
  return {
    id: String(company.id),
    slug: company.slug,
    name: company.name,
    description: company.description || '',
    website: company.website || '',
    logoUrl: company.logoUrl || '',
    industry: company.industry || '',
    headquarters: company.headquarters || '',
    ...(articleCount === undefined ? {} : { articleCount }),
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

export function learningCompanySlug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'company';
}

function boundedText(value, label, maxLength, required = false) {
  const text = clean(value);
  if (required && !text) throw new InputError(`${label} is required`);
  if (text.length > maxLength) throw new InputError(`${label} must be ${maxLength.toLocaleString()} characters or fewer`);
  return text || null;
}

function httpUrl(value, label) {
  const text = clean(value);
  if (!text) throw new InputError(`${label} is required`);
  if (text.length > 2_048) throw new InputError(`${label} must be 2,048 characters or fewer`);
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
  } catch {
    throw new InputError(`${label} must use a valid HTTP or HTTPS URL`);
  }
  return text;
}
