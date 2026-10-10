import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
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
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const positionTypeEnum = pgEnum("position_type", [
  "president",
  "head",
  "lead",
  "core",
]);

// Dashboard v2 orders (issue #172, drizzle/0010): the team leader can send a
// request back for changes, and the lead can cancel one.
export const orderStatusEnum = pgEnum("status", [
  "pending",
  "accepted",
  "rejected",
  "changes_requested",
  "cancelled",
]);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "rejected",
  "accepted",
  "received",
  "accepted_by_another_team",
  // The lead's recruitment flow (issue #171): times offered for an interview,
  // and a person who joined the team after the signed NDA arrived.
  "interview",
  "joined",
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
  // Set when the person is moved to alumni (issue #172): the years they were
  // on the team as their lead gave them. Why they left goes to team_leaves.
  teamFrom: integer("team_from"),
  teamTo: integer("team_to"),
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
  // From the application form (issue #120); politoId, program, levelOfStudy
  // and origin above are reused for its other fields.
  phone: text("phone"),
  dateOfBirth: date("date_of_birth", { mode: "string" }),
  gender: text("gender"),
  referralSource: text("referral_source"),
  // "Your details" on My account and My profile (issue #169).
  country: text("country"),
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
  // Delete account (issue #191): when the person closed their account, and
  // when the identifying fields were cleared, a year or more later
  // (lib/dashboard/anonymize.ts).
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "string" }),
  anonymizedAt: timestamp("anonymized_at", { withTimezone: true, mode: "string" }),
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
  // The team leader's answer when they send a request back (issue #172).
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by").references(() => members.memberId),
  reviewedAt: timestamp("reviewed_at", {
    withTimezone: true,
    mode: "string",
  }),
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

// The site-wide recruitment switch (issue #119). One row: the primary key can
// only be `true`, so a second row cannot exist. With the switch off no
// position is public, whatever its own status (`isPublic` in
// lib/apply/positions.ts). Missing row or table reads as on.
export const recruitmentSetting = pgTable(
  "recruitment_setting",
  {
    id: boolean("id").primaryKey().default(true),
    isOpen: boolean("is_open").default(true).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    singleRow: check("recruitment_setting_single_row", sql`id`),
  }),
);

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),
  applyPositionId: integer("apply_position_id").references(
    () => applyPositions.id,
  ),
  userId: text("user_id").references(() => users.id),
  cvFileId: integer("cv_file_id").references(() => applicationFiles.id, {
    onDelete: "set null",
  }),
  coverLetterFileId: integer("cover_letter_file_id").references(
    () => applicationFiles.id,
    {
      onDelete: "set null",
    },
  ),
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
  /** When the applicant withdrew it (issue #169); the lead no longer sees it. */
  withdrawnAt: timestamp("withdrawn_at", {
    withTimezone: true,
    mode: "string",
  }),
  // The lead's recruitment flow (issue #171). Accept sets `accepted_at`; the
  // "The signed NDA arrived" tick sets `nda_arrived_at`; Confirm join sets
  // `joined_at` once the person is on the team.
  acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
  ndaArrivedAt: timestamp("nda_arrived_at", { withTimezone: true, mode: "string" }),
  joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" }),
}, (table) => ({
  // One live application per user per position (issue #120); a withdrawn one
  // does not count, so the person can apply again (issue #169).
  userPositionActive: uniqueIndex("applications_user_position_active")
    .on(table.userId, table.applyPositionId)
    .where(sql`${table.withdrawnAt} is null`),
  cvFileIdIdx: index("applications_cv_file_id_idx").on(table.cvFileId),
  coverLetterFileIdIdx: index("applications_cover_letter_file_id_idx").on(
    table.coverLetterFileId,
  ),
}));

export const applicationFiles = pgTable("application_files", {
  id: serial("id").primaryKey(),
  /** The file's pathname in the private file store. The column keeps its old name. */
  pathname: text("r2_key").notNull().unique(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  fileHash: text("file_hash"),
  uploadedAt: timestamp("uploaded_at", {
    withTimezone: true,
    mode: "string",
  }).defaultNow(),
  userId: text("user_id").references(() => users.id),
}, (table) => ({
  r2KeyIdx: index("application_files_r2_key_idx").on(table.pathname),
  fileHashIdx: index("application_files_file_hash_idx").on(table.fileHash),
}));

/**
 * The interview times a division lead offers on one application (issue #169;
 * the lead's side is issue #171). The applicant picks one: `chosen`, at
 * `chosen_at`. At most one slot per application is chosen.
 */
export const interviewSlots = pgTable("interview_slots", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .references(() => applications.id, { onDelete: "cascade" })
    .notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "string" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "string" }).notNull(),
  chosen: boolean("chosen").default(false).notNull(),
  chosenAt: timestamp("chosen_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
}, (table) => ({
  applicationIdx: index("interview_slots_application_idx").on(table.applicationId),
  oneChosen: uniqueIndex("interview_slots_one_chosen")
    .on(table.applicationId)
    .where(sql`${table.chosen}`),
}));

/** A member leaving the team from My profile (issue #169), with the reason they gave. */
export const teamLeaves = pgTable("team_leaves", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .references(() => members.memberId, { onDelete: "cascade" })
    .notNull(),
  reason: text("reason"),
  leftAt: timestamp("left_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
}, (table) => ({
  memberIdx: index("team_leaves_member_idx").on(table.memberId),
}));

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
