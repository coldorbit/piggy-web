import { Op } from 'sequelize';
import { getFaqModel } from '../../../../db.js';
import { InputError, NotFoundError } from '../../../utils/errors.js';
import { isAdminRole } from '../../../utils/roles.js';

export const FAQ_STATUSES = {
  draft: 'draft',
  published: 'published',
};

export async function listFaqsForUser(user) {
  const Faq = getFaqModel();
  const where = isAdminRole(user) ? {} : { status: FAQ_STATUSES.published };
  const faqs = await Faq.findAll({
    where,
    order: [
      ['status', 'ASC'],
      ['publishedAt', 'DESC'],
      ['updatedAt', 'DESC'],
    ],
  });
  return faqs.map(publicFaq);
}

export async function findFaqForUser(id, user) {
  const Faq = getFaqModel();
  const where = { id };
  if (!isAdminRole(user)) where.status = FAQ_STATUSES.published;
  const faq = await Faq.findOne({ where });
  if (!faq) throw new NotFoundError('FAQ not found');
  return publicFaq(faq);
}

export async function createFaq({ body, user }) {
  const attrs = faqAttributesFromBody(body);
  const Faq = getFaqModel();
  const now = new Date();
  const faq = await Faq.create({
    ...attrs,
    createdByUserId: user?.id || null,
    publishedAt: attrs.status === FAQ_STATUSES.published ? now : null,
  });
  return publicFaq(faq);
}

export async function updateFaq({ id, body }) {
  const Faq = getFaqModel();
  const faq = await Faq.findByPk(id);
  if (!faq) throw new NotFoundError('FAQ not found');

  const attrs = faqAttributesFromBody(body);
  await faq.update({
    ...attrs,
    publishedAt: attrs.status === FAQ_STATUSES.published ? faq.publishedAt || new Date() : null,
  });
  return publicFaq(faq);
}

export async function deleteFaq(id) {
  const Faq = getFaqModel();
  const deleted = await Faq.destroy({ where: { id: { [Op.eq]: id } } });
  if (!deleted) throw new NotFoundError('FAQ not found');
}

function faqAttributesFromBody(body = {}) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const status = String(body.status || FAQ_STATUSES.draft).trim();

  if (!title) throw new InputError('FAQ title is required');
  if (!content) throw new InputError('FAQ content is required');
  if (!Object.values(FAQ_STATUSES).includes(status)) {
    throw new InputError('FAQ status must be draft or published');
  }

  return { title, content, status };
}

export function publicFaq(faq) {
  return {
    id: String(faq.id),
    title: faq.title,
    content: faq.content,
    status: faq.status,
    createdByUserId: faq.createdByUserId ? String(faq.createdByUserId) : null,
    publishedAt: faq.publishedAt,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  };
}
