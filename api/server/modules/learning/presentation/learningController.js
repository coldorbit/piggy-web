import {
  createLearningArticle,
  deleteLearningArticle,
  findLearningArticleForUser,
  listLearningArticlesForUser,
  updateLearningArticle,
} from '../application/learningService.js';
import { ensureWebModels } from '../../../../db.js';
import { handleInputError } from '../../../utils/errors.js';

export async function listLearningArticles(req, res, next) {
  try {
    await ensureWebModels();
    const articles = await listLearningArticlesForUser(req.user, req.query);
    res.json({ articles });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function getLearningArticle(req, res, next) {
  try {
    await ensureWebModels();
    const article = await findLearningArticleForUser(req.params.id, req.user);
    res.json({ article });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createLearningArticleRecord(req, res, next) {
  try {
    await ensureWebModels();
    const article = await createLearningArticle({ body: req.body, user: req.user });
    res.status(201).json({ article });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function updateLearningArticleRecord(req, res, next) {
  try {
    await ensureWebModels();
    const article = await updateLearningArticle({ id: req.params.id, body: req.body });
    res.json({ article });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteLearningArticleRecord(req, res, next) {
  try {
    await ensureWebModels();
    await deleteLearningArticle(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
