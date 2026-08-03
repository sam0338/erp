function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
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
