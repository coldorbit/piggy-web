import { getScrapedJobModel } from '../models/index.js';

export function findJobById(id) {
  return getScrapedJobModel().findByPk(id);
}

export function findJobsAndCount(query) {
  return getScrapedJobModel().findAndCountAll(query);
}

export function countJobs(query = {}) {
  return getScrapedJobModel().count(query);
}
