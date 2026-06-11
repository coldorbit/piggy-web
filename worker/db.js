export { getSequelize } from './db/connection.js';
export {
  getBidProfileModel,
  getScrapedJobModel,
  getTailoredResumeModel,
} from './db/models/index.js';

export async function initializeWorkerModels() {
  const { getSequelize } = await import('./db/connection.js');
  const { getBidProfileModel, getScrapedJobModel, getTailoredResumeModel } = await import('./db/models/index.js');

  getBidProfileModel();
  getScrapedJobModel();
  getTailoredResumeModel();
  await getSequelize().authenticate();
}
