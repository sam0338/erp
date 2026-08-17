const express = require('express');
const db = require('../db/connection');
const { logActivity } = require('../utils/helpers');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Categories are a shared managed list (like distributors/doctors), not
// store-scoped — the same catalog of medicine categories applies across
// every branch. items.category itself stays plain TEXT (see schema.sql);
// this table just gives the item form's Category field a proper managed
// list + icon instead of a free-text datalist, matching MediStore Pro.

function validateCategoryBody(body, { partial } = {}) {
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) return 'name is required';
  }
  return null;
}

// GET /api/categories - list, with a live medicine count per category
// (matched against items.category by name — see the note above on why
// there's no FK). Counting is informational only; deleting a category
// never cascades into items.
router.get('/', (req, res) => {
  const { include_inactive } = req.query;
  let query = `
    SELECT c.*,
      COALESCE((SELECT COUNT(*) FROM items i WHERE i.category = c.name AND i.is_active = 1), 0) AS item_count
    FROM categories c
    WHERE 1 = 1
  `;
  if (!include_inactive) query += ' AND c.is_active = 1';
  query += ' ORDER BY c.name COLLATE NOCASE';
  res.json(db.prepare(query).all());
});

// GET /api/categories/:id
router.get('/:id', (req, res) => {
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json(category);
});

// POST /api/categories - create
router.post('/', requireRole('Pharmacist'), (req, res) => {
  const err = validateCategoryBody(req.body);
  if (err) return res.status(400).json({ error: err });

  const { name, icon, description } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO categories (name, icon, description) VALUES (?, ?, ?)
    `).run(name.trim(), icon || null, description || null);
    logActivity(db, req.session.userId, 'category_created', 'category', info.lastInsertRowid, { name });
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: `Category "${name}" already exists` });
    }
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/categories/:id - update
router.put('/:id', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const err = validateCategoryBody(req.body, { partial: true });
  if (err) return res.status(400).json({ error: err });

  const fields = ['name', 'icon', 'description', 'is_active'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  });
  if (updates.length === 0) return res.json({ success: true });

  params.push(id);
  try {
    db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    // Renaming a category doesn't rewrite items.category to match (no FK,
    // free-text storage — see schema.sql) — that's an accepted limitation,
    // consistent with the decision not to migrate existing item data.
    logActivity(db, req.session.userId, 'category_updated', 'category', id, req.body);
    res.json({ success: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(400).json({ error: `Category "${req.body.name}" already exists` });
    }
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/categories/:id - soft delete. Not blocked by items still using
// the name (no FK to enforce it either way) — it just drops off the item
// form's picklist; existing items keep their stored category text as-is.
router.delete('/:id', requireRole('Pharmacist'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });
  db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id);
  logActivity(db, req.session.userId, 'category_deactivated', 'category', id, null);
  res.json({ success: true });
});

module.exports = router;
