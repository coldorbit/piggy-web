export function updateCachedCalendarBidQueries(queryClient, { bidId, jobId, bidData }) {
  queryClient.setQueriesData({ queryKey: ['calendar', 'interviews'] }, (oldData) => {
    if (!oldData?.jobs) return oldData;
    const callerWasUpdated = Object.prototype.hasOwnProperty.call(bidData || {}, 'callerUserId');
    const callerUser = callerWasUpdated
      ? oldData.callerUsers?.find((user) => String(user.id) === String(bidData.callerUserId)) || null
      : undefined;
    return {
      ...oldData,
      jobs: oldData.jobs.map((job) => {
        const matchesBid = String(job.interviewId || job.bid?.parentInterviewId || '') === String(bidId || '');
        const matchesJob = jobId && String(job.bid?.jobId || '') === String(jobId);
        if (!matchesBid && !matchesJob) return job;
        return {
          ...job,
          bid: {
            ...(job.bid || {}),
            ...(bidData || {}),
            ...(callerWasUpdated ? { callerUser } : {}),
          },
        };
      }),
    };
  });
}

export function updateCachedCalendarCallQueries(queryClient, interviewCallId, callData) {
  queryClient.setQueriesData({ queryKey: ['calendar', 'interviews'] }, (oldData) => {
    if (!oldData?.jobs) return oldData;
    return {
      ...oldData,
      jobs: oldData.jobs.map((job) => {
        if (String(job.interviewCallId || job.bid?.interviewCallId || '') !== String(interviewCallId)) return job;
        return {
          ...job,
          bid: {
            ...(job.bid || {}),
            ...(callData?.scheduledAt ? { interviewNextAt: callData.scheduledAt } : {}),
            ...(callData?.durationMinutes ? { interviewDurationMinutes: callData.durationMinutes } : {}),
          },
        };
      }),
    };
  });
}
