import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { dayProgressPercent, localDayProgressPercent } from '../../lib/timezone.js';

export default function BidDailyGoalBar({ activeColor, dateLabel, isCurrentDate, profile }) {
  const totalGoal = Number(profile?.progress?.dailyGoal || 0);
  const totalFinished = Number(profile?.progress?.dailyFinished || 0);
  const users = dailyApplicationRows(profile);
  const dayPercent = profileGoalDayProgressPercent(profile);
  const dateContext = [dateLabel, profile?.progress?.dailyGoalTimezone].filter(Boolean).join(' - ');
  if (!totalGoal && !totalFinished) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1,
        px: 1.25,
        py: 1,
        display: 'grid',
        gap: 0.75,
        bgcolor: '#f8fafc',
        borderColor: totalFinished >= totalGoal ? '#bbf7d0' : activeColor.soft,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="body2" fontWeight={900}>
          {profile?.name ? `${profile.name} daily bid goal` : 'Profile daily bid goal'}
        </Typography>
        <Typography variant="body2" fontWeight={900} color="text.secondary">
          {totalGoal
            ? `${totalFinished.toLocaleString()} / ${totalGoal.toLocaleString()} applications ${dateContext}`
            : `${totalFinished.toLocaleString()} applications ${dateContext}`}
        </Typography>
      </Box>
      {totalGoal ? (
        <DailyGoalRow
          activeColor={activeColor}
          goal={{ goal: totalGoal, finished: totalFinished, username: 'Profile' }}
          isCurrentDate={isCurrentDate}
          dayPercent={dayPercent}
        />
      ) : null}
      {users.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          {users.map((user) => (
            <Typography key={user.userId || user.username} variant="caption" color="text.secondary" fontWeight={800}>
              {[user.username || 'User', roleLabel(user.role)].filter(Boolean).join(' - ')}: {user.finished.toLocaleString()}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Paper>
  );
}

function DailyGoalRow({ activeColor, dayPercent = localDayProgressPercent(), goal, isCurrentDate }) {
  const percent = Math.min((goal.finished / goal.goal) * 100, 100);
  const isComplete = goal.finished >= goal.goal;
  const isOnTrack = isComplete || (isCurrentDate && percent + 2 >= dayPercent);
  const statusLabel = isComplete ? 'Complete' : isCurrentDate && isOnTrack ? 'On track' : 'Below goal';
  const statusColor = isComplete ? '#15803d' : isOnTrack ? activeColor.dark : '#b45309';
  const remaining = Math.max(goal.goal - goal.finished, 0);

  return (
    <Box sx={{ display: 'grid', gap: 0.45 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="caption" fontWeight={900}>
          {[goal.username || 'User', roleLabel(goal.role)].filter(Boolean).join(' - ')}
        </Typography>
        <Typography variant="caption" fontWeight={900} sx={{ color: statusColor }}>
          {goal.finished.toLocaleString()} / {goal.goal.toLocaleString()}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 7,
          borderRadius: 1,
          bgcolor: '#e5e7eb',
          '& .MuiLinearProgress-bar': {
            borderRadius: 1,
            bgcolor: statusColor,
          },
        }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>
          {statusLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>
          {remaining ? `${remaining.toLocaleString()} remaining` : 'Goal reached'}
        </Typography>
      </Box>
    </Box>
  );
}

function dailyApplicationRows(profile) {
  const users = Array.isArray(profile?.progress?.dailyUsers) ? profile.progress.dailyUsers : [];
  return users
    .map((user) => ({
      userId: user.userId,
      username: user.username,
      role: user.role,
      timezone: user.timezone,
      finished: Number(user.finished || 0),
    }))
    .filter((user) => user.finished > 0);
}

function profileGoalDayProgressPercent(profile) {
  const timeZone = profile?.progress?.dailyGoalTimezone;
  return timeZone ? dayProgressPercent(new Date(), { timeZone }) : localDayProgressPercent();
}

function roleLabel(role) {
  if (role === 'readonly_bidder' || role === 'editable_bidder' || role === 'bidder') return 'bidder';
  if (role === 'user') return 'user';
  return '';
}
