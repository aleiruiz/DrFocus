import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Esquema local (TECH_SPEC §5). Instantes en ISO UTC; zonas IANA aparte. */

export const preferences = sqliteTable('preferences', {
  singletonId: integer('singleton_id').primaryKey().default(1),
  role: text('role', { enum: ['student', 'teacher'] }).notNull(),
  timezone: text('timezone').notNull(),
  preferredBlockMinutes: integer('preferred_block_minutes').notNull().default(20),
  remindersEnabled: integer('reminders_enabled', { mode: 'boolean' }).notNull().default(true),
  quietStart: text('quiet_start').notNull().default('21:00'),
  quietEnd: text('quiet_end').notNull().default('08:00'),
  dailyCap: integer('daily_cap').notNull().default(4),
  participantAlias: text('participant_alias').notNull(),
  onboardingVersion: integer('onboarding_version').notNull().default(0),
  remindersCoveredUntil: text('reminders_covered_until'),
});

export const availabilityRules = sqliteTable('availability_rules', {
  id: text('id').primaryKey(),
  weekday: integer('weekday').notNull(),
  startLocal: text('start_local').notNull(),
  endLocal: text('end_local').notNull(),
  timezone: text('timezone').notNull(),
});

export const availabilityExceptions = sqliteTable('availability_exceptions', {
  id: text('id').primaryKey(),
  localDate: text('local_date').notNull(),
  startLocal: text('start_local').notNull(),
  endLocal: text('end_local').notNull(),
  kind: text('kind', { enum: ['available', 'blocked'] }).notNull(),
});

export const activities = sqliteTable(
  'activities',
  {
    id: text('id').primaryKey(),
    role: text('role', { enum: ['student', 'teacher'] }).notNull(),
    typeId: text('type_id').notNull(),
    templateVersion: integer('template_version').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    expectedResult: text('expected_result').notNull().default(''),
    requirementsJson: text('requirements_json').notNull().default('{}'),
    deadlineAt: text('deadline_at').notNull(),
    deadlineZone: text('deadline_zone').notNull(),
    status: text('status', { enum: ['draft', 'active', 'completed', 'archived'] }).notNull(),
    revision: integer('revision').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('activities_status_idx').on(t.status, t.deletedAt)],
);

export const objectives = sqliteTable(
  'objectives',
  {
    id: text('id').primaryKey(),
    activityId: text('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    expectedResult: text('expected_result').notNull(),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    remainingMinutes: integer('remaining_minutes').notNull(),
    dueAt: text('due_at'),
    status: text('status', { enum: ['todo', 'in_progress', 'completed', 'skipped'] }).notNull(),
    orderIndex: integer('order_index').notNull(),
    completedAt: text('completed_at'),
    source: text('source', { enum: ['template', 'agent', 'manual'] }).notNull(),
    isReview: integer('is_review', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('objectives_activity_idx').on(t.activityId, t.orderIndex), index('objectives_status_idx').on(t.status)],
);

export const objectiveDependencies = sqliteTable(
  'objective_dependencies',
  {
    objectiveId: text('objective_id')
      .notNull()
      .references(() => objectives.id, { onDelete: 'cascade' }),
    dependsOnId: text('depends_on_id')
      .notNull()
      .references(() => objectives.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.objectiveId, t.dependsOnId] }), check('no_self_dependency', sql`${t.objectiveId} <> ${t.dependsOnId}`)],
);

export const workSessions = sqliteTable(
  'work_sessions',
  {
    id: text('id').primaryKey(),
    objectiveId: text('objective_id')
      .notNull()
      .references(() => objectives.id, { onDelete: 'cascade' }),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    timezone: text('timezone').notNull(),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: ['planned', 'done', 'cancelled'] }).notNull().default('planned'),
  },
  (t) => [index('sessions_start_idx').on(t.startsAt), index('sessions_objective_idx').on(t.objectiveId)],
);

export const planRevisions = sqliteTable(
  'plan_revisions',
  {
    id: text('id').primaryKey(),
    activityId: text('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['initial', 'replan', 'split'] }).notNull(),
    baseRevision: integer('base_revision').notNull(),
    proposedJson: text('proposed_json').notNull(),
    assumptionsJson: text('assumptions_json').notNull().default('[]'),
    createdAt: text('created_at').notNull(),
    acceptedAt: text('accepted_at'),
    state: text('state', { enum: ['draft', 'accepted', 'rejected'] }).notNull(),
  },
  (t) => [index('revisions_activity_idx').on(t.activityId, t.state)],
);

export const scheduledReminders = sqliteTable('scheduled_reminders', {
  nativeId: text('native_id').primaryKey(),
  activityId: text('activity_id').notNull(),
  objectiveId: text('objective_id'),
  kind: text('kind').notNull(),
  fireAt: text('fire_at').notNull(),
});

export const agentDrafts = sqliteTable('agent_drafts', {
  id: text('id').primaryKey(),
  activityId: text('activity_id'),
  requestId: text('request_id').notNull(),
  inputJson: text('input_json').notNull(),
  proposedJson: text('proposed_json'),
  updatedAt: text('updated_at').notNull(),
});

/** Borradores del formulario de actividad (S05), para no perder lo escrito. */
export const formDrafts = sqliteTable('form_drafts', {
  typeId: text('type_id').primaryKey(),
  json: text('json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const localEvents = sqliteTable(
  'local_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    entityId: text('entity_id'),
    occurredAt: text('occurred_at').notNull(),
    propertiesJson: text('properties_json').notNull().default('{}'),
  },
  (t) => [index('events_time_idx').on(t.occurredAt)],
);

export type Activity = typeof activities.$inferSelect;
export type Objective = typeof objectives.$inferSelect;
export type WorkSession = typeof workSessions.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type AvailabilityRuleRow = typeof availabilityRules.$inferSelect;
export type PlanRevision = typeof planRevisions.$inferSelect;
