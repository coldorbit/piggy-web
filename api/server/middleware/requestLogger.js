export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const user = req.user?.username || 'anonymous';
    const status = res.statusCode;
    const path = requestPathWithoutQuery(req);
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    console[level](`${req.method} ${path} ${status} ${durationMs.toFixed(1)}ms user=${user}`);
  });

  next();
}

function requestPathWithoutQuery(req) {
  const rawPath = req.originalUrl || req.url || '';
  return rawPath.split('?')[0] || '/';
}
