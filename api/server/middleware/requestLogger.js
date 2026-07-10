export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  const writeHead = res.writeHead;

  res.writeHead = function writeHeadWithTiming(...args) {
    const durationMs = elapsedMilliseconds(startedAt);
    if (!res.headersSent) res.setHeader('Server-Timing', `total;dur=${durationMs.toFixed(1)}`);
    return writeHead.apply(this, args);
  };

  res.on('finish', () => {
    const durationMs = elapsedMilliseconds(startedAt);
    const user = req.user?.username || 'anonymous';
    const status = res.statusCode;
    const path = requestPathWithQueryKeys(req);
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    console[level](`${req.method} ${path} ${status} ${durationMs.toFixed(1)}ms user=${user}`);
  });

  next();
}

function elapsedMilliseconds(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function requestPathWithQueryKeys(req) {
  const rawPath = req.originalUrl || req.url || '';
  const [pathname, rawQuery = ''] = rawPath.split('?');
  const keys = [...new URLSearchParams(rawQuery).keys()];
  return keys.length ? `${pathname}?${[...new Set(keys)].sort().join(',')}` : pathname || '/';
}
