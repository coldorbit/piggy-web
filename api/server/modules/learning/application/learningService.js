import { Op } from 'sequelize';
import { getLearningArticleModel } from '../../../../db.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { clean } from '../../../utils/index.js';
import { isAdminRole } from '../../../utils/roles.js';

export const LEARNING_CATEGORIES = ['companies', 'geography', 'machine_learning'];
export const LEARNING_STATUSES = ['draft', 'published'];
export const LEARNING_DIFFICULTIES = ['', 'foundation', 'intermediate', 'advanced', 'staff_plus'];
const MAX_EXCALIDRAW_BYTES = 5_000_000;
const MAX_EXCALIDRAW_ELEMENTS = 5_000;
const MAX_MERMAID_CHARACTERS = 50_000;

export async function listLearningArticlesForUser(user, query = {}) {
  const where = isAdminRole(user) ? {} : { status: 'published' };
  const category = clean(query.category);
  const search = clean(query.search);
  if (category && category !== 'all') {
    if (!LEARNING_CATEGORIES.includes(category)) throw new InputError('Choose a valid learning category');
    where.category = category;
  }
  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { title: { [Op.iLike]: pattern } },
      { summary: { [Op.iLike]: pattern } },
      { content: { [Op.iLike]: pattern } },
      { companyName: { [Op.iLike]: pattern } },
      { city: { [Op.iLike]: pattern } },
      { region: { [Op.iLike]: pattern } },
    ];
  }
  const rows = await getLearningArticleModel().findAll({
    where,
    order: [['featured', 'DESC'], ['status', 'ASC'], ['publishedAt', 'DESC'], ['updatedAt', 'DESC']],
  });
  return rows.map(publicLearningArticle);
}

export async function findLearningArticleForUser(id, user) {
  const where = { id };
  if (!isAdminRole(user)) where.status = 'published';
  const row = await getLearningArticleModel().findOne({ where });
  if (!row) throw new NotFoundError('Learning article not found');
  return publicLearningArticle(row);
}

export async function createLearningArticle({ body, user }) {
  const attrs = learningArticleAttributesFromBody(body);
  const now = new Date();
  const row = await getLearningArticleModel().create({
    ...attrs,
    createdByUserId: user?.id || null,
    publishedAt: attrs.status === 'published' ? now : null,
  });
  return publicLearningArticle(row);
}

export async function updateLearningArticle({ id, body }) {
  const row = await getLearningArticleModel().findByPk(id);
  if (!row) throw new NotFoundError('Learning article not found');
  const attrs = learningArticleAttributesFromBody(body, row);
  await row.update({
    ...attrs,
    publishedAt: attrs.status === 'published' ? row.publishedAt || new Date() : null,
  });
  return publicLearningArticle(row);
}

export async function deleteLearningArticle(id) {
  const deleted = await getLearningArticleModel().destroy({ where: { id } });
  if (!deleted) throw new NotFoundError('Learning article not found');
}

export function learningArticleAttributesFromBody(body = {}, current = {}) {
  const category = clean(body.category ?? current.category);
  const title = clean(body.title ?? current.title);
  const summary = clean(body.summary ?? current.summary);
  const content = clean(body.content ?? current.content);
  const status = clean(body.status ?? current.status ?? 'draft');
  const difficulty = clean(body.difficulty ?? current.difficulty).toLowerCase();
  if (!LEARNING_CATEGORIES.includes(category)) throw new InputError('Choose companies, geography, or machine learning');
  if (!title) throw new InputError('Article title is required');
  if (title.length > 240) throw new InputError('Article title must be 240 characters or fewer');
  if (!summary) throw new InputError('Article summary is required');
  if (summary.length > 1000) throw new InputError('Article summary must be 1,000 characters or fewer');
  if (!content) throw new InputError('Article content is required');
  if (content.length > 200_000) throw new InputError('Article content is too long');
  if (!LEARNING_STATUSES.includes(status)) throw new InputError('Article status must be draft or published');
  if (!LEARNING_DIFFICULTIES.includes(difficulty)) throw new InputError('Choose a valid difficulty');

  const companyName = category === 'companies' ? nullableText(body.companyName ?? current.companyName, 240) : null;
  if (category === 'companies' && !companyName) throw new InputError('Company name is required for company articles');

  return {
    category,
    title,
    summary,
    content,
    excalidrawData: excalidrawScene(bodyValue(body, 'excalidrawData', current.excalidrawData)),
    mermaidScript: mermaidSource(bodyValue(body, 'mermaidScript', current.mermaidScript)),
    tags: stringList(body.tags ?? current.tags, 20),
    companyName,
    city: category === 'geography' ? nullableText(body.city ?? current.city, 180) : null,
    region: category === 'geography' ? nullableText(body.region ?? current.region, 180) : null,
    countryCode: category === 'geography' ? countryCode(body.countryCode ?? current.countryCode) : null,
    difficulty: category === 'machine_learning' ? difficulty || null : null,
    sourceLinks: sourceList(body.sourceLinks ?? current.sourceLinks),
    featured: booleanFromBody(body.featured ?? current.featured),
    status,
  };
}

export function publicLearningArticle(row) {
  return {
    id: String(row.id),
    category: row.category,
    title: row.title,
    summary: row.summary,
    content: row.content,
    excalidrawData: row.excalidrawData || null,
    mermaidScript: row.mermaidScript || '',
    tags: row.tags || [],
    companyName: row.companyName || '',
    city: row.city || '',
    region: row.region || '',
    countryCode: row.countryCode || '',
    difficulty: row.difficulty || '',
    sourceLinks: row.sourceLinks || [],
    featured: Boolean(row.featured),
    status: row.status,
    createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function bodyValue(body, key, currentValue) {
  return Object.prototype.hasOwnProperty.call(body, key) ? body[key] : currentValue;
}

function excalidrawScene(value) {
  if (value === null || value === undefined || value === '') return null;
  let scene = value;
  if (typeof value === 'string') {
    try {
      scene = JSON.parse(value);
    } catch {
      throw new InputError('Excalidraw data must be valid scene JSON');
    }
  }
  if (!scene || Array.isArray(scene) || typeof scene !== 'object' || !Array.isArray(scene.elements)) {
    throw new InputError('Excalidraw data must contain an elements array');
  }
  if (scene.elements.length > MAX_EXCALIDRAW_ELEMENTS) {
    throw new InputError(`Excalidraw scenes can contain no more than ${MAX_EXCALIDRAW_ELEMENTS.toLocaleString()} elements`);
  }
  if (scene.appState !== undefined && (!scene.appState || Array.isArray(scene.appState) || typeof scene.appState !== 'object')) {
    throw new InputError('Excalidraw appState must be an object');
  }
  if (scene.files !== undefined && (!scene.files || Array.isArray(scene.files) || typeof scene.files !== 'object')) {
    throw new InputError('Excalidraw files must be an object');
  }
  let serialized;
  try {
    serialized = JSON.stringify(scene);
  } catch {
    throw new InputError('Excalidraw data must be JSON serializable');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_EXCALIDRAW_BYTES) {
    throw new InputError('Excalidraw data must be smaller than 5 MB');
  }
  return JSON.parse(serialized);
}

function mermaidSource(value) {
  const source = clean(value);
  if (!source) return null;
  if (source.length > MAX_MERMAID_CHARACTERS) {
    throw new InputError('Mermaid scripts must be 50,000 characters or fewer');
  }
  return source;
}

function stringList(value, maxItems) {
  const values = Array.isArray(value) ? value : clean(value).split(',');
  const unique = [...new Set(values.map((item) => clean(item)).filter(Boolean))];
  if (unique.length > maxItems) throw new InputError(`Use no more than ${maxItems} tags`);
  if (unique.some((item) => item.length > 100)) throw new InputError('Tags must be 100 characters or fewer');
  return unique;
}

function sourceList(value) {
  const values = Array.isArray(value) ? value : clean(value).split(/\r?\n/);
  const sources = values.map((source) => {
    if (typeof source === 'string') return { label: source, url: source };
    return { label: clean(source?.label || source?.url), url: clean(source?.url) };
  }).filter((source) => source.url);
  if (sources.length > 20) throw new InputError('Use no more than 20 source links');
  for (const source of sources) {
    try {
      const url = new URL(source.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new InputError('Sources must use valid HTTP or HTTPS URLs');
    }
  }
  return sources;
}

function nullableText(value, maxLength) {
  const text = clean(value);
  if (text.length > maxLength) throw new InputError(`Text must be ${maxLength} characters or fewer`);
  return text || null;
}

function countryCode(value) {
  const code = clean(value).toUpperCase();
  if (code && !/^[A-Z]{2}$/.test(code)) throw new InputError('Country code must use two letters, such as US');
  return code || null;
}

function booleanFromBody(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}
