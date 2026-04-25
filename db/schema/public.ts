import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const positionTypeEnum = pgEnum("position_type", [
  "president",
  "head",
  "lead",
  "core",
]);

export const orderStatusEnum = pgEnum("status", [
  "pending",
  "accepted",
  "rejected",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "rejected",
  "accepted",
  "received",
  "accepted_by_another_team",
]);

export const scopeTypeEnum = pgEnum("scope_type", [
  "admin",
  "org",
  "department",
  "division",
  "website",
]);

export const targetTypeEnum = pgEnum("target_type", [
  "all",
  "positions",
  "applications",
  "members",
  "orders",
  "faq",
  "blog",
  "logs",
]);

export const accessLevelTypeEnum = pgEnum("access_level_type", [
  "view",
  "edit",
]);

export const members = pgTable("members", {
  memberId: serial("member_id").primaryKey(),
  prtEmail: text("prt_email"),
  mobileNumber: text("mobile_number"),
  discord: text("discord"),
  ndaSignedAt: timestamp("nda_signed_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  ndaName: text("nda_name"),
  ndaConfirmedBy: integer("nda_confirmed_by"),
  picture: text("picture"),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  origin: text("origin"),
  levelOfStudy: text("level_of_study"),
  linkedin: text("linkedin"),
  politoId: text("polito_id"),
  program: text("program"),
  member: integer("member").references(() => members.memberId),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    withTimezone: true,
    mode: "string",
  }),
  access: text("access")
    .array()
    .default(sql`'{}'::text[]`),
}, (table) => ({
  memberIdx: index("users_member_idx").on(table.member),
}));

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startedAt: date("started_at", { mode: "string" })
    .default(sql`now()`)
    .notNull(),
  closedAt: date("closed_at", { mode: "string" }),
  code: text("code"),
});

export const divisions = pgTable("divisions", {
  id: serial("id").primaryKey(),
  deptId: integer("dept_id").references(() => departments.id),
  name: text("name").notNull(),
  startedAt: date("started_at", { mode: "string" })
    .default(sql`now()`)
    .notNull(),
  closedAt: date("closed_at", { mode: "string" }),
  code: text("code"),
}, (table) => ({
  deptIdIdx: index("divisions_dept_id_idx").on(table.deptId),
  closedAtIdx: index("divisions_closed_at_idx").on(table.closedAt),
}));

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").references(() => members.memberId),
  deptId: integer("dept_id").references(() => departments.id),
  divisionId: integer("division_id").references(() => divisions.id),
  title: text("title").notNull(),
  startedAt: date("started_at", { mode: "string" })
    .default(sql`now()`)
    .notNull(),
  leavedAt: date("leaved_at", { mode: "string" }),
  type: positionTypeEnum("type"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  status: orderStatusEnum("status").default("pending").notNull(),
  requester: integer("requester").references(() => members.memberId),
  description: text("description"),
  reason: text("reason"),
  quantity: integer("quantity"),
  price: numeric("price"),
  name: text("name"),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  quoteName: text("quote_name"),
});

export const applyPositions = pgTable("apply_positions", {
  id: serial("id").primaryKey(),
  status: boolean("status").notNull(),
  divisionId: integer("division_id").references(() => divisions.id),
  title: text("title"),
  description: text("description"),
  requiredSkills: text("required_skills").array(),
  desirableSkills: text("desirable_skills").array(),
  customQuestions: text("custom_questions").array(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  requiresMotivationLetter: boolean("requires_motivation_letter")
    .default(false)
    .notNull(),
  isDeleted: boolean("is_deleted").default(false).notNull(),
}, (table) => ({
  divisionIdIdx: index("apply_positions_division_id_idx").on(table.divisionId),
  isDeletedIdx: index("apply_positions_is_deleted_idx").on(table.isDeleted),
  statusIdx: index("apply_positions_status_idx").on(table.status),
}));

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  applyPositionId: integer("apply_position_id").references(
    () => applyPositions.id,
  ),
  userId: text("user_id").references(() => users.id),
  mlName: text("ml_name"),
  cvName: text("cv_name"),
  appliedAt: timestamp("applied_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
  status: applicationStatusEnum("status").default("received").notNull(),
  customAnswers: jsonb("custom_answers").array(),
});

export const scopes = pgTable(
  "scopes",
  {
    id: serial("id").primaryKey(),
    memberId: integer("member_id").references(() => members.memberId, {
      onDelete: "cascade",
    }),
    givenBy: integer("given_by").references(() => members.memberId, {
      onDelete: "set null",
    }),
    scope: scopeTypeEnum("scope").notNull(),
    target: targetTypeEnum("target").notNull(),
    accessLevel: accessLevelTypeEnum("access_level").default("view").notNull(),
    deptId: integer("dept_id").references(() => departments.id),
    divisionId: integer("division_id").references(() => divisions.id),
  },
  (table) => ({
    uniqueScopeCombination: unique("unique_scope_combination").on(
      table.memberId,
      table.scope,
      table.target,
      table.deptId,
      table.divisionId,
    ),
  }),
);

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  schemaName: text("schema_name").notNull(),
  tableName: text("table_name").notNull(),
  operation: text("operation").notNull(),
  recordId: text("record_id"),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  changedBy: text("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});
