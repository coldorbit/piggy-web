import { createFaq, deleteFaq, findFaqForUser, listFaqsForUser, updateFaq } from '../application/faqsService.js';
import { handleInputError } from '../../../utils/errors.js';

export async function listFaqs(req, res, next) {
  try {
    const faqs = await listFaqsForUser(req.user);
    res.json({ faqs });
  } catch (error) {
    next(error);
  }
}

export async function getFaq(req, res, next) {
  try {
    const faq = await findFaqForUser(req.params.id, req.user);
    res.json({ faq });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createFaqRecord(req, res, next) {
  try {
    const faq = await createFaq({ body: req.body, user: req.user });
    res.status(201).json({ faq });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateFaqRecord(req, res, next) {
  try {
    const faq = await updateFaq({ id: req.params.id, body: req.body });
    res.json({ faq });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteFaqRecord(req, res, next) {
  try {
    await deleteFaq(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
