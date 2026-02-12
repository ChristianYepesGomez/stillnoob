import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================
// USERS & AUTH
// ============================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').default('en'),
  tier: text('tier').default('free'), // 'free' | 'premium' | 'admin'
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

export const authProviders = sqliteTable('auth_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google' | 'discord' | 'blizzard' | 'warcraftlogs'
  providerUserId: text('provider_user_id').notNull(),
  providerEmail: text('provider_email'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: text('token_expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('auth_provider_unique').on(table.provider, table.providerUserId),
]);

export const refreshTokens = sqliteTable('refresh_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  tokenFamily: text('token_family').notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('refresh_family_idx').on(table.tokenFamily),
]);

// ============================================
// CHARACTERS
// ============================================

export const characters = sqliteTable('characters', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  realm: text('realm').notNull(),
  realmSlug: text('realm_slug').notNull(),
  region: text('region').notNull().default('eu'),
  className: text('class_name').notNull(), // 'Warrior', 'Mage', etc.
  classId: integer('class_id'),
  spec: text('spec'),
  raidRole: text('raid_role'), // 'Tank' | 'Healer' | 'DPS'
  level: integer('level').default(0),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(false),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('char_unique').on(table.name, table.realmSlug, table.region),
  index('char_user_idx').on(table.userId),
]);

// ============================================
// GUILDS
// ============================================

export const guilds = sqliteTable('guilds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  realm: text('realm').notNull(),
  realmSlug: text('realm_slug').notNull(),
  region: text('region').notNull().default('eu'),
  ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wclGuildId: integer('wcl_guild_id'),
  avatarUrl: text('avatar_url'),
  settings: text('settings').default('{}'), // JSON: { defaultVisibility, autoImport, ... }
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('guild_unique').on(table.realmSlug, table.region, table.name),
]);

export const guildMembers = sqliteTable('guild_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guildId: integer('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'), // 'leader' | 'officer' | 'member'
  joinedAt: text('joined_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('guild_member_unique').on(table.guildId, table.userId),
  index('guild_member_user_idx').on(table.userId),
]);

// ============================================
// REPORTS & FIGHTS
// ============================================

export const reports = sqliteTable('reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wclCode: text('wcl_code').notNull().unique(),
  title: text('title'),
  startTime: integer('start_time'), // epoch ms
  endTime: integer('end_time'),
  region: text('region'),
  guildName: text('guild_name'),
  zoneName: text('zone_name'),
  participantsCount: integer('participants_count').default(0),
  importedBy: text('imported_by').references(() => users.id, { onDelete: 'set null' }),
  importSource: text('import_source').default('manual'), // 'manual' | 'auto' | 'url'
  visibility: text('visibility').notNull().default('public'), // 'public' | 'private' | 'guild'
  guildId: integer('guild_id').references(() => guilds.id, { onDelete: 'set null' }),
  processedAt: text('processed_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('report_imported_by_idx').on(table.importedBy),
]);

export const fights = sqliteTable('fights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull().references(() => reports.id, { onDelete: 'cascade' }),
  wclFightId: integer('wcl_fight_id').notNull(),
  encounterId: integer('encounter_id').notNull(),
  bossName: text('boss_name').notNull(),
  difficulty: text('difficulty').notNull(),
  isKill: integer('is_kill', { mode: 'boolean' }).default(false),
  startTime: integer('start_time'),
  endTime: integer('end_time'),
  durationMs: integer('duration_ms').default(0),
}, (table) => [
  uniqueIndex('fight_unique').on(table.reportId, table.wclFightId),
  index('fight_encounter_idx').on(table.encounterId),
  index('fight_difficulty_idx').on(table.difficulty),
  index('fight_time_idx').on(table.startTime),
]);

// ============================================
// CORE: Per-player per-fight performance
// ============================================

export const fightPerformance = sqliteTable('fight_performance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fightId: integer('fight_id').notNull().references(() => fights.id, { onDelete: 'cascade' }),
  characterId: integer('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  // Core metrics
  damageDone: integer('damage_done').default(0),
  healingDone: integer('healing_done').default(0),
  damageTaken: integer('damage_taken').default(0),
  deaths: integer('deaths').default(0),
  // Computed rates
  dps: real('dps').default(0),
  hps: real('hps').default(0),
  dtps: real('dtps').default(0),
  // Consumables
  healthPotions: integer('health_potions').default(0),
  healthstones: integer('healthstones').default(0),
  combatPotions: integer('combat_potions').default(0),
  flaskUptimePct: real('flask_uptime_pct').default(0),
  foodBuffActive: integer('food_buff_active', { mode: 'boolean' }).default(false),
  augmentRuneActive: integer('augment_rune_active', { mode: 'boolean' }).default(false),
  // Utility
  interrupts: integer('interrupts').default(0),
  dispels: integer('dispels').default(0),
  // Raid context
  raidMedianDps: real('raid_median_dps').default(0),
  raidMedianDtps: real('raid_median_dtps').default(0),
  // Metadata
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('perf_unique').on(table.fightId, table.characterId),
  index('perf_char_idx').on(table.characterId),
]);

// ============================================
// BOSS REFERENCE DATA
// ============================================

export const bosses = sqliteTable('bosses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  encounterId: integer('encounter_id').notNull().unique(),
  name: text('name').notNull(),
  zoneName: text('zone_name'),
  imageUrl: text('image_url'),
});
