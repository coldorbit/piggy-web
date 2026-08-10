export function getHealth(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    status: 'healthy',
    service: 'applypilot-api',
  });
}
