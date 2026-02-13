import { Router } from 'express';
import { db } from '../db/client.js';
import { guilds, guildMembers, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { authenticateToken } from '../middleware/auth.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Route:Guilds');
const router = Router();
router.use(authenticateToken);

// POST /api/v1/guilds — create a guild
router.post('/', async (req, res) => {
  try {
    const { name, realm, realmSlug, region = 'eu' } = req.body;

    if (!name || !realm || !realmSlug) {
      return res.status(400).json({ error: 'Name, realm, and realmSlug are required' });
    }

    // Check if guild already exists
    const existing = await db.select({ id: guilds.id })
      .from(guilds)
      .where(
        and(
          eq(guilds.realmSlug, realmSlug.toLowerCase()),
          eq(guilds.region, region.toLowerCase()),
          eq(guilds.name, name),
        )
      )
      .get();

    if (existing) {
      return res.status(409).json({ error: 'Guild already exists' });
    }

    const [guild] = await db.insert(guilds).values({
      name,
      realm,
      realmSlug: realmSlug.toLowerCase(),
      region: region.toLowerCase(),
      ownerId: req.user.id,
    }).returning();

    // Auto-add creator as leader
    await db.insert(guildMembers).values({
      guildId: guild.id,
      userId: req.user.id,
      role: 'leader',
    });

    res.status(201).json(guild);
  } catch (err) {
    log.error('Create guild failed', err);
    res.status(500).json({ error: 'Failed to create guild' });
  }
});

// GET /api/v1/guilds — list my guilds
router.get('/', async (req, res) => {
  try {
    const memberships = await db.select({
      guildId: guildMembers.guildId,
      role: guildMembers.role,
      guildName: guilds.name,
      realm: guilds.realm,
      region: guilds.region,
      avatarUrl: guilds.avatarUrl,
    })
      .from(guildMembers)
      .innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
      .where(eq(guildMembers.userId, req.user.id))
      .all();

    res.json(memberships);
  } catch (err) {
    log.error('Get guilds failed', err);
    res.status(500).json({ error: 'Failed to get guilds' });
  }
});

// GET /api/v1/guilds/:id — guild detail with members
router.get('/:id', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    // Check membership
    const membership = await db.select({ role: guildMembers.role })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)))
      .get();

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this guild' });
    }

    const guild = await db.select().from(guilds).where(eq(guilds.id, guildId)).get();
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    const members = await db.select({
      userId: guildMembers.userId,
      role: guildMembers.role,
      joinedAt: guildMembers.joinedAt,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
      .from(guildMembers)
      .innerJoin(users, eq(guildMembers.userId, users.id))
      .where(eq(guildMembers.guildId, guildId))
      .all();

    const response = {
      id: guild.id,
      name: guild.name,
      realm: guild.realm,
      realmSlug: guild.realmSlug,
      region: guild.region,
      avatarUrl: guild.avatarUrl,
      members,
      myRole: membership.role,
    };

    // Only leader/officer can see the invite code
    if (['leader', 'officer'].includes(membership.role)) {
      response.inviteCode = guild.inviteCode;
    }

    res.json(response);
  } catch (err) {
    log.error('Get guild failed', err);
    res.status(500).json({ error: 'Failed to get guild' });
  }
});

// POST /api/v1/guilds/:id/join — join a guild via invite code
router.post('/:id/join', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    const { inviteCode } = req.body;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const guild = await db.select({ id: guilds.id, inviteCode: guilds.inviteCode })
      .from(guilds).where(eq(guilds.id, guildId)).get();
    if (!guild) {
      return res.status(404).json({ error: 'Guild not found' });
    }

    if (guild.inviteCode !== inviteCode) {
      return res.status(403).json({ error: 'Invalid invite code' });
    }

    await db.insert(guildMembers).values({
      guildId,
      userId: req.user.id,
      role: 'member',
    }).onConflictDoNothing();

    res.json({ message: 'Joined guild' });
  } catch (err) {
    log.error('Join guild failed', err);
    res.status(500).json({ error: 'Failed to join guild' });
  }
});

// POST /api/v1/guilds/:id/leave — leave a guild
router.post('/:id/leave', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    // Can't leave if you're the owner
    const guild = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).get();
    if (guild && guild.ownerId === req.user.id) {
      return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership first.' });
    }

    await db.delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)));

    res.json({ message: 'Left guild' });
  } catch (err) {
    log.error('Leave guild failed', err);
    res.status(500).json({ error: 'Failed to leave guild' });
  }
});

// PUT /api/v1/guilds/:id/members/:userId — update member role (leader/officer only)
router.put('/:id/members/:userId', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }
    const targetUserId = req.params.userId;
    const { role } = req.body;

    if (!['member', 'officer', 'leader'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be member, officer, or leader' });
    }

    // Check caller is leader or officer
    const callerMembership = await db.select({ role: guildMembers.role })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)))
      .get();

    if (!callerMembership || !['leader', 'officer'].includes(callerMembership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Only leader can promote to leader/officer
    if (role === 'leader' && callerMembership.role !== 'leader') {
      return res.status(403).json({ error: 'Only the guild leader can promote to leader' });
    }

    await db.update(guildMembers)
      .set({ role })
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)));

    res.json({ message: 'Role updated' });
  } catch (err) {
    log.error('Update member failed', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// DELETE /api/v1/guilds/:id/members/:userId — kick member (leader/officer only)
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }
    const targetUserId = req.params.userId;

    // Can't kick yourself (use leave)
    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Use /leave to leave the guild' });
    }

    // Check caller permissions
    const callerMembership = await db.select({ role: guildMembers.role })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)))
      .get();

    if (!callerMembership || !['leader', 'officer'].includes(callerMembership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await db.delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)));

    res.json({ message: 'Member removed' });
  } catch (err) {
    log.error('Kick member failed', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// PATCH /api/v1/guilds/:id/settings — update guild settings (leader only)
router.patch('/:id/settings', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }
    const { defaultVisibility } = req.body;

    // Check caller is leader
    const membership = await db.select({ role: guildMembers.role })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)))
      .get();

    if (!membership || membership.role !== 'leader') {
      return res.status(403).json({ error: 'Only guild leader can change settings' });
    }

    const guild = await db.select({ settings: guilds.settings }).from(guilds).where(eq(guilds.id, guildId)).get();
    const currentSettings = JSON.parse(guild?.settings || '{}');

    if (defaultVisibility && ['public', 'private', 'guild'].includes(defaultVisibility)) {
      currentSettings.defaultVisibility = defaultVisibility;
    }

    await db.update(guilds).set({ settings: JSON.stringify(currentSettings) }).where(eq(guilds.id, guildId));

    res.json({ settings: currentSettings });
  } catch (err) {
    log.error('Update settings failed', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/v1/guilds/:id/invite-code — regenerate invite code (leader/officer only)
router.post('/:id/invite-code', async (req, res) => {
  try {
    const guildId = parseInt(req.params.id);
    if (isNaN(guildId)) {
      return res.status(400).json({ error: 'Invalid guild ID' });
    }

    const membership = await db.select({ role: guildMembers.role })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.user.id)))
      .get();

    if (!membership || !['leader', 'officer'].includes(membership.role)) {
      return res.status(403).json({ error: 'Only leader or officer can regenerate invite code' });
    }

    const newCode = crypto.randomUUID().slice(0, 8);
    await db.update(guilds).set({ inviteCode: newCode }).where(eq(guilds.id, guildId));

    res.json({ inviteCode: newCode });
  } catch (err) {
    log.error('Regenerate invite code failed', err);
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

export default router;
