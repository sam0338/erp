const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.username = ? AND u.is_active = 1
  `).get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.fullName = user.full_name;
  req.session.roleName = user.role_name;
  req.session.propertyId = user.property_id;

  db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);
  logActivity(db, user.id, 'login', 'user', user.id, null);

  res.json({
    success: true,
    user: {
      username: user.username,
      fullName: user.full_name,
      role: user.role_name,
      propertyId: user.property_id
    }
  });
});

router.post('/logout', (req, res) => {
  const userId = req.session.userId;
  if (userId) logActivity(db, userId, 'logout', 'user', userId, null);
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    username: req.session.username,
    fullName: req.session.fullName,
    role: req.session.roleName,
    propertyId: req.session.propertyId
  });
});

module.exports = router;
