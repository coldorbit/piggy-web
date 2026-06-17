import { ensureWebModels } from '../../../../db.js';
import { handleInputError } from '../../../utils/errors.js';
import { currentDbUser } from '../../bidding/application/profilesService.js';
import {
  assessmentProfilesForUser,
  assessmentsForProfile,
  createAssessmentForUser,
  deleteAssessmentForUser,
} from '../application/assessmentsService.js';

export async function listAssessmentProfiles(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const profiles = await assessmentProfilesForUser(user);
    res.json({ profiles });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function listAssessments(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const data = await assessmentsForProfile(user, req.query.profileId);
    res.json(data);
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function createAssessment(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    const assessment = await createAssessmentForUser(user, req.body);
    res.status(201).json({ assessment });
  } catch (error) {
    handleInputError(error, res, next);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    await ensureWebModels();
    const user = await currentDbUser(req);
    await deleteAssessmentForUser(user, req.params.id);
    res.json({ ok: true });
  } catch (error) {
    handleInputError(error, res, next);
  }
}
