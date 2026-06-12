export function formatDashboardResponse({
  grain,
  grainOptions,
  overall,
  trend,
  users,
  bidders,
  callers,
  profileFunnels,
  roleFamilyFunnels,
  userSources,
  userCategories,
  userProfiles,
  sources,
  bidStatuses,
  interviewStages,
  interviewStatuses,
}) {
  const sourceMixByUserId = rowsByUser(userSources, 'source');
  const categoryMixByUserId = rowsByUser(userCategories, 'category');
  const profileMixByUserId = rowsByUser(userProfiles, 'profile_name');
  const bucketCount = Math.max(trend.length, 1);

  return {
    grain,
    grainOptions,
    generatedAt: new Date().toISOString(),
    totals: formatTotals(overall),
    trend: trend.map(formatTrendRow),
    users: users.map((row) => formatUserRow(row, {
      bucketCount,
      sourceMix: sourceMixByUserId.get(String(row.id)) || [],
      categoryMix: categoryMixByUserId.get(String(row.id)) || [],
      profileMix: profileMixByUserId.get(String(row.id)) || [],
    })),
    bidders: bidders.map(formatBidderRow),
    callers: callers.map((row) => formatCallerRow(row, { bucketCount })),
    funnels: {
      profiles: profileFunnels.map(formatFunnelRow('profile_name')),
      roleFamilies: roleFamilyFunnels.map(formatFunnelRow('role_family')),
    },
    breakdowns: {
      sources: sources.map(formatCountRow('source')),
      bidStatuses: bidStatuses.map(formatCountRow('status')),
      interviewStages: interviewStages.map(formatCountRow('stage')),
      interviewStatuses: interviewStatuses.map(formatCountRow('status')),
    },
  };
}

function formatBidderRow(row) {
  const values = camelizeKeys(numberFields(row, [
    'applications',
    'interviews',
    'offers',
    'lost',
    'profiles_used',
    'role_families',
  ]));

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    ...values,
    firstApplicationAt: row.first_application_at || null,
    lastApplicationAt: row.last_application_at || null,
    applicationToInterviewRate: rate(values.interviews, values.applications),
    interviewToOfferRate: rate(values.offers, values.interviews),
    applicationToOfferRate: rate(values.offers, values.applications),
    lossRate: rate(values.lost, values.interviews),
  };
}

function formatFunnelRow(nameKey) {
  return (row) => {
    const values = camelizeKeys(numberFields(row, [
      'applications',
      'interviews',
      'offers',
      'lost',
    ]));

    return {
      id: row.id || row[nameKey],
      name: row[nameKey] || 'Unknown',
      ...values,
      applicationToInterviewRate: rate(values.interviews, values.applications),
      interviewToOfferRate: rate(values.offers, values.interviews),
      applicationToOfferRate: rate(values.offers, values.applications),
      lossRate: rate(values.lost, values.interviews),
    };
  };
}

function formatTotals(row) {
  const totals = numberFields(row, [
    'total_jobs',
    'manual_jobs',
    'scraped_jobs',
    'hidden_jobs',
    'spam_jobs',
    'reviewed_good_jobs',
    'unreviewed_jobs',
    'total_applications',
    'planned_applications',
    'submitted_applications',
    'interviewing_applications',
    'won_applications',
    'lost_applications',
    'review_blocked_applications',
    'total_interviews',
    'active_interviews',
    'technical_interviews',
    'successful_technical_interviews',
    'final_interviews',
    'successful_final_interviews',
    'successful_offers',
    'lost_interviews',
    'tailored_resume_requests',
    'ready_tailored_resumes',
  ]);

  return {
    ...camelizeKeys(totals),
    applicationToInterviewRate: rate(totals.total_interviews, totals.total_applications),
    interviewToOfferRate: rate(totals.successful_offers, totals.total_interviews),
    finalToOfferRate: rate(totals.successful_final_interviews, totals.final_interviews),
    technicalSuccessRate: rate(totals.successful_technical_interviews, totals.technical_interviews),
    tailoringReadyRate: rate(totals.ready_tailored_resumes, totals.tailored_resume_requests),
  };
}

function formatTrendRow(row) {
  const values = camelizeKeys(numberFields(row, [
    'jobs',
    'applications',
    'submitted',
    'interviewing_applications',
    'won_applications',
    'lost_applications',
    'interviews',
    'active_interviews',
    'technical_interviews',
    'successful_technical_interviews',
    'final_interviews',
    'successful_final_interviews',
    'offers',
    'lost_interviews',
  ]));

  return {
    label: row.label,
    bucketStart: row.bucket_start,
    ...values,
  };
}

function formatUserRow(row, mixes = {}) {
  const values = camelizeKeys(numberFields(row, [
    'applications',
    'planned',
    'submitted',
    'interviewing_applications',
    'won_applications',
    'lost_applications',
    'review_blocked_applications',
    'interviews',
    'active_interviews',
    'technical_interviews',
    'successful_technical_interviews',
    'final_interviews',
    'successful_final_interviews',
    'offers',
    'lost_interviews',
    'first_interviews_scheduled',
    'upcoming_interviews',
    'unscheduled_active_interviews',
    'profiles',
    'active_profiles',
    'inactive_profiles',
    'shared_profiles',
    'tailored_resume_requests',
    'ready_tailored_resumes',
    'failed_tailored_resumes',
    'downloaded_tailored_resumes',
  ]));

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    ...values,
    firstApplicationAt: row.first_application_at || null,
    lastApplicationAt: row.last_application_at || null,
    firstInterviewAt: row.first_interview_at || null,
    lastInterviewActivityAt: row.last_interview_activity_at || null,
    avgDaysFromScheduledToCreated: Number(row.avg_days_from_scheduled_to_created || 0),
    avgDaysFromApplicationToInterview: Number(row.avg_days_from_application_to_interview || 0),
    averageApplicationsPerPeriod: values.applications / Math.max(mixes.bucketCount || 1, 1),
    applicationToInterviewRate: rate(values.interviews, values.applications),
    interviewToOfferRate: rate(values.offers, values.interviews),
    applicationToOfferRate: rate(values.offers, values.applications),
    finalToOfferRate: rate(values.successfulFinalInterviews, values.finalInterviews),
    technicalSuccessRate: rate(values.successfulTechnicalInterviews, values.technicalInterviews),
    tailoringReadyRate: rate(values.readyTailoredResumes, values.tailoredResumeRequests),
    sourceMix: mixes.sourceMix || [],
    categoryMix: mixes.categoryMix || [],
    profileMix: mixes.profileMix || [],
  };
}

function formatCallerRow(row, { bucketCount = 1 } = {}) {
  const values = camelizeKeys(numberFields(row, [
    'assigned_interviews',
    'active_interviews',
    'completed_interviews',
    'won_interviews',
    'lost_interviews',
    'upcoming_interviews',
    'unscheduled_active_interviews',
    'interviews_with_meeting_links',
    'screening_interviews',
    'hiring_manager_interviews',
    'technical_interviews',
    'final_interviews',
  ]));

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    ...values,
    firstAssignmentAt: row.first_assignment_at || null,
    lastAssignmentActivityAt: row.last_assignment_activity_at || null,
    averageAssignmentsPerPeriod: values.assignedInterviews / Math.max(bucketCount, 1),
    callerOfferRate: rate(values.wonInterviews, values.assignedInterviews),
    callerLossRate: rate(values.lostInterviews, values.assignedInterviews),
    meetingLinkCoverageRate: rate(values.interviewsWithMeetingLinks, values.assignedInterviews),
  };
}

function formatCountRow(key) {
  return (row) => ({
    name: row[key] || 'Unknown',
    count: Number(row.count || 0),
  });
}

function rowsByUser(rows, nameKey) {
  const byUser = new Map();

  for (const row of rows) {
    const userId = String(row.user_id);
    const items = byUser.get(userId) || [];
    items.push({
      name: row[nameKey] || 'Unknown',
      count: Number(row.count || 0),
    });
    byUser.set(userId, items);
  }

  return byUser;
}

function numberFields(row, fields) {
  return Object.fromEntries(fields.map((field) => [field, Number(row[field] || 0)]));
}

function camelizeKeys(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [camelize(key), value]));
}

function camelize(value) {
  return String(value).replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}
