function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // req.path is relative to wherever this middleware is mounted (e.g.
  // app.use('/api/items', requireAuth, ...) strips '/api/items' off of
  // it), so it can't be used to detect an API request here. req.originalUrl
  // stays absolute no matter how deep the mount, so use that instead.
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.redirect('/login.html');
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.roleName) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (req.session.roleName === 'Admin' || allowedRoles.includes(req.session.roleName)) {
      return next();
    }
    return res.status(403).json({ error: 'Insufficient permissions' });
  };
}

module.exports = { requireAuth, requireRole };
