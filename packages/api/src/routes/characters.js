import { Router } from 'express';
import { db } from '../db/client.js';
import { characters } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Route:Characters');
const router = Router();

// All routes require auth
router.use(authenticateToken);

// GET /api/v1/characters — list my characters
router.get('/', async (req, res) => {
  try {
    const chars = await db
      .select()
      .from(characters)
      .where(eq(characters.userId, req.user.id))
      .all();

    res.json(chars);
  } catch (err) {
    log.error('Get characters failed', err);
    res.status(500).json({ error: 'Failed to get characters' });
  }
});

// POST /api/v1/characters — add character manually
router.post('/', async (req, res) => {
  try {
    const { name, realm, realmSlug, region, className, spec, raidRole } = req.body;

    if (!name || !realm || !className) {
      return res.status(400).json({ error: 'Name, realm, and class are required' });
    }

    const slug = realmSlug || realm.toLowerCase().replace(/\s+/g, '-');

    const result = await db
      .insert(characters)
      .values({
        userId: req.user.id,
        name: name.trim().normalize('NFC'),
        realm,
        realmSlug: slug,
        region: region || 'eu',
        className,
        spec: spec || null,
        raidRole: raidRole || null,
      })
      .returning();

    res.status(201).json(result[0]);
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Character already exists' });
    }
    log.error('Add character failed', err);
    res.status(500).json({ error: 'Failed to add character' });
  }
});

// PUT /api/v1/characters/:id/primary — set as primary character
router.put('/:id/primary', async (req, res) => {
  try {
    const charId = parseInt(req.params.id);
    if (isNaN(charId)) {
      return res.status(400).json({ error: 'Invalid character ID' });
    }

    // Verify ownership
    const char = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)))
      .get();

    if (!char) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Unset all primary flags for this user
    await db.update(characters).set({ isPrimary: false }).where(eq(characters.userId, req.user.id));

    // Set this one as primary
    await db.update(characters).set({ isPrimary: true }).where(eq(characters.id, charId));

    res.json({ message: 'Primary character updated' });
  } catch (err) {
    log.error('Set primary failed', err);
    res.status(500).json({ error: 'Failed to set primary character' });
  }
});

// DELETE /api/v1/characters/:id — remove character
router.delete('/:id', async (req, res) => {
  try {
    const charId = parseInt(req.params.id);
    if (isNaN(charId)) {
      return res.status(400).json({ error: 'Invalid character ID' });
    }

    const result = await db
      .delete(characters)
      .where(and(eq(characters.id, charId), eq(characters.userId, req.user.id)));

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }

    res.json({ message: 'Character removed' });
  } catch (err) {
    log.error('Delete character failed', err);
    res.status(500).json({ error: 'Failed to remove character' });
  }
});

export default router;
