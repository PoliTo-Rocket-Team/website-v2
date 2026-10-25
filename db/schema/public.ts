import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// `advisor` (issue #253, drizzle/0026): the role someone holds after handing
// over a role and staying in the team. It sits on the former lead's division,
// the former head's department, or on neither for a former team leader. It
// leads nothing and heads nothing.
export const positionTypeEnum = pgEnum("position_type", [
  "president",
  "head",
  "lead",
  "core",
  "advisor",
]);

// Dashboard v2 orders (issue #172, drizzle/0010): the team leader can send a
// request back for changes, and the lead can cancel one. An approved request
// is marked `ordered` once it is placed with the shop (issue #247, drizzle/0019).
export const orderStatusEnum = pgEnum("status", [
  "pending",
  "accepted",
  "rejected",
  "changes_requested",
  "cancelled",
  "ordered",
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
  // A team-wide grant in no unit: "Approve orders" (issue #233, drizzle/0017),
  // or an area given across the whole team (issue #247, drizzle/0019).
  "team",
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
  // "Approve orders", given by the team leader on scope `team` (issue #233).
  "approve_orders",
  // The Content grant, on scope `website` (issue #504, drizzle/0049). It opens
  // the Alumni page too; the old Alumni `website` rows on `all` are read as
  // nothing (issue #589, drizzle/0058).
  "content",
]);

// The seats besides the team leader that hold every access in the dashboard
// (issue #238, drizzle/0018; the Project Manager and the Chief Engineer since
// issue #485, drizzle/0047): set once on the seat's role row.
export const fullAccessSeatEnum = pgEnum("full_access_seat", [
  "operations_lead",
  "it_lead",
  "project_manager",
  "chief_engineer",
]);

export const accessLevelTypeEnum = pgEnum("access_level_type", [
  "view",
  "edit",
]);

// Site content with drafts (issue #256, lib/content/versioned.ts): each
// content item keeps the version the public site shows and an optional
// working draft, one row each. Every content type's version table reuses it.
export const contentVersionEnum = pgEnum("content_version", [
  "published",
  "draft",
]);

export const partnerTierEnum = pgEnum("partner_tier", ["main", "media"]);

// Which slide of the Team page's departments carousel a department's head
// sits on: "Technical Departments" or "Operations" (issue #325, ADR 0015).
export const departmentKindEnum = pgEnum("department_kind", ["technical", "operations"]);

export const partnerLogoKindEnum = pgEnum("partner_logo_kind", [
  "wordmark",
  "mark",
]);

/**
 * The acting account beside a member-id "by" column (issue #605,
 * drizzle/0061): the account behind the View as session that made the write,
 * while the "by" column names the person viewed as. Null for a write made
 * outside View as.
 */
const actingAccount = (name: string) => text(name).references((): AnyPgColumn => users.id, { onDelete: "set null", onUpdate: "cascade" });

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
  ndaConfirmedByActingAccount: actingAccount("nda_confirmed_by_acting_account"),
  picture: text("picture"),
  // Set when the person is moved to alumni (issue #172): the years they were
  // on the team as their lead gave them. Why they left goes to team_leaves.
  teamFrom: integer("team_from"),
  teamTo: integer("team_to"),
  // Deprecated (issue #563): the member's team email alias lives in
  // `prt_email`, where Mark created writes it, and nothing reads or writes
  // this column any more. drizzle/0053 copied each value into an empty
  // `prt_email`; #569 drops the column. Do not use it.
  emailAlias: text("email_alias"),
  // When the member said they set up their alias, the address in
  // `prt_email` (issue #542).
  emailAliasSetUpAt: timestamp("email_alias_set_up_at", { withTimezone: true, mode: "string" }),
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
  kind: departmentKindEnum("kind").default("technical").notNull(),
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
  // Marks the operations lead's, the IT lead's (issue #238), the Project
  // Manager's and the Chief Engineer's (issue #485) seats; null on every
  // other role. The team leader is the `president` type and needs none.
  fullAccess: fullAccessSeatEnum("full_access"),
}, (table) => ({
  // One active holder per seat (issue #667, drizzle/0062): one team leader,
  // one holder of each full-access seat and one head per department. Only
  // active rows count, so ended rows beside an active one are kept.
  oneActiveTeamLeader: uniqueIndex("roles_one_active_team_leader")
    .on(table.type)
    .where(sql`${table.leavedAt} is null and ${table.type} = 'president'`),
  oneActiveFullAccessSeat: uniqueIndex("roles_one_active_full_access_seat")
    .on(table.fullAccess)
    .where(sql`${table.leavedAt} is null and ${table.fullAccess} is not null`),
  oneActiveDepartmentHead: uniqueIndex("roles_one_active_department_head")
    .on(table.deptId)
    .where(sql`${table.leavedAt} is null and ${table.type} = 'head' and ${table.deptId} is not null`),
}));

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
  reviewedByActingAccount: actingAccount("reviewed_by_acting_account"),
  reviewedAt: timestamp("reviewed_at", {
    withTimezone: true,
    mode: "string",
  }),
  // The division the order was made for (issue #233, drizzle/0017); null only
  // for an old order whose requester held no role in a division.
  divisionId: integer("division_id").references(() => divisions.id),
}, (table) => ({
  divisionIdx: index("orders_division_id_idx").on(table.divisionId),
}));

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
  // Reject, or another team taking the person, sets `rejected_at` (issue
  // #317): the decision time the one-month rule on the applicant's pages reads.
  rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: "string" }),
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
 * `chosen_at`. At most one slot per application is chosen. `offered_by` is
 * the account that offered the times (issue #652), which the Overview's
 * upcoming interviews name; null for times stored before it was recorded.
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
  offeredBy: text("offered_by").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
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

/**
 * Someone a lead or head added to a division who is not on the team yet
 * (issue #231): "Waiting for NDA" until Confirm NDA. The person is a `users`
 * row: their account when they have one, else a row keyed `added:<uuid>`
 * that holds the email they were added with, as rows from the old site do.
 * The `sync_auth_users` trigger (drizzle/0001) gives that row their account
 * id when they first sign in with the email, and `user_id` follows it
 * (ON UPDATE CASCADE). They hold no member row and no role, so nothing reads
 * them as a member; Confirm NDA creates both and deletes this row. The PRT
 * email and Discord wait here, since they live on the member row.
 */
export const teamJoins = pgTable("team_joins", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" })
    .notNull(),
  divisionId: integer("division_id")
    .references(() => divisions.id)
    .notNull(),
  title: text("title"),
  prtEmail: text("prt_email"),
  discord: text("discord"),
  addedBy: integer("added_by").references(() => members.memberId, { onDelete: "set null" }),
  addedByActingAccount: actingAccount("added_by_acting_account"),
  addedAt: timestamp("added_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
}, (table) => ({
  userDivision: uniqueIndex("team_joins_user_division").on(table.userId, table.divisionId),
  divisionIdx: index("team_joins_division_idx").on(table.divisionId),
}));

/**
 * A notice on one member's dashboard (issue #201), shown under "Needs your
 * attention" until they dismiss it. `kind` names what happened and `data`
 * holds what the notice says about it; lib/dashboard/notices.ts owns both,
 * so a new kind needs no new column.
 */
export const dashboardNotices = pgTable("dashboard_notices", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id")
    .references(() => members.memberId, { onDelete: "cascade" })
    .notNull(),
  kind: text("kind").notNull(),
  /** The member the notice is about. */
  subjectId: integer("subject_id")
    .references(() => members.memberId, { onDelete: "cascade" })
    .notNull(),
  data: jsonb("data").default(sql`'{}'::jsonb`).notNull(),
  /**
   * The acting account behind the View as session that wrote the notice
   * (issue #628); null for one written outside View as.
   */
  writtenByActingAccount: actingAccount("written_by_acting_account"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: "string" }),
}, (table) => ({
  recipientIdx: index("dashboard_notices_recipient_idx").on(table.recipientId),
}));

/** What the person who hands over a role does next (lib/dashboard/hand-over.ts). */
export const handOverOutcomeEnum = pgEnum("hand_over_outcome", ["advisor", "leave"]);

/** The role a lead or head hands over from My profile: never the team leader's (board 77i). */
export const handOverRoleEnum = pgEnum("hand_over_role", ["lead", "head"]);

/**
 * How a hand-over request closed: answered by the next level up, or lapsed
 * when its sender's roles changed before anyone answered (drizzle/0029,
 * `hasLapsed` in lib/dashboard/hand-over-request.ts).
 */
export const handOverDecisionEnum = pgEnum("hand_over_decision", ["confirmed", "declined", "lapsed"]);

/**
 * A hand-over a division lead or a department head sent from My profile
 * (issue #262, board 55d). It changes no role until the next level up
 * confirms it from their Overview (board 62c); lib/dashboard/hand-over-request.ts
 * owns who that is. A lead hands over a division, a head a department, and
 * one person has at most one request waiting.
 */
export const handOverRequests = pgTable("hand_over_requests", {
  id: serial("id").primaryKey(),
  fromId: integer("from_id")
    .references(() => members.memberId, { onDelete: "cascade" })
    .notNull(),
  role: handOverRoleEnum("role").notNull(),
  divisionId: integer("division_id").references(() => divisions.id),
  deptId: integer("dept_id").references(() => departments.id),
  toId: integer("to_id")
    .references(() => members.memberId, { onDelete: "cascade" })
    .notNull(),
  outcome: handOverOutcomeEnum("outcome").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  decision: handOverDecisionEnum("decision"),
  decidedBy: integer("decided_by").references(() => members.memberId, { onDelete: "set null" }),
  decidedByActingAccount: actingAccount("decided_by_acting_account"),
  decidedAt: timestamp("decided_at", { withTimezone: true, mode: "string" }),
}, (table) => ({
  oneWaiting: uniqueIndex("hand_over_requests_one_waiting").on(table.fromId).where(sql`${table.decision} is null`),
  unit: check(
    "hand_over_requests_unit",
    sql`(${table.role} = 'lead' and ${table.divisionId} is not null and ${table.deptId} is null) or (${table.role} = 'head' and ${table.deptId} is not null and ${table.divisionId} is null)`,
  ),
  someoneElse: check("hand_over_requests_someone_else", sql`${table.fromId} <> ${table.toId}`),
  decided: check("hand_over_requests_decided", sql`(${table.decision} is null) = (${table.decidedAt} is null)`),
}));

/** How an alias request closed (lib/dashboard/alias-request.ts); null while it is open. */
export const aliasRequestOutcomeEnum = pgEnum("alias_request_outcome", ["created", "declined", "cancelled"]);

/**
 * A request for a team email alias for one member (epic #538, issue #541,
 * drizzle/0051): asked by a division lead, a department head or the team
 * leader, or by the site itself (`requestedBy` null), and answered by the team
 * leader, the operations lead or the IT lead. One member has at most one
 * open request; lib/dashboard/alias-request.ts owns the rules.
 */
export const aliasRequests = pgTable("alias_requests", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .references(() => members.memberId, { onDelete: "cascade" })
    .notNull(),
  requestedBy: integer("requested_by").references(() => members.memberId, { onDelete: "set null" }),
  requestedByActingAccount: actingAccount("requested_by_acting_account"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  outcome: aliasRequestOutcomeEnum("outcome"),
  answeredBy: integer("answered_by").references(() => members.memberId, { onDelete: "set null" }),
  answeredByActingAccount: actingAccount("answered_by_acting_account"),
  answeredAt: timestamp("answered_at", { withTimezone: true, mode: "string" }),
}, (table) => ({
  oneOpen: uniqueIndex("alias_requests_one_open").on(table.memberId).where(sql`${table.outcome} is null`),
  answered: check("alias_requests_answered", sql`(${table.outcome} is null) = (${table.answeredAt} is null)`),
}));

// The Alumni page (issue #257). The page is built from the roles; an entry
// holds only how one person shows on it, so a fix never writes a role, a
// division or access. A member's entry is keyed by their member row and made
// on the first fix; an imported person's (drizzle/0021) and an external
// advisor's (board 78c) hold the name they were imported or added with.
export const alumniEntryKindEnum = pgEnum("alumni_entry_kind", [
  "member",
  "imported",
  "advisor",
]);

export const alumniFounderEnum = pgEnum("alumni_founder", [
  "founder",
  "co_founder",
]);

export const alumniEntries = pgTable("alumni_entries", {
  id: serial("id").primaryKey(),
  kind: alumniEntryKindEnum("kind").notNull(),
  // A member's entry only; it outlives the member row's private fields.
  memberId: integer("member_id").references(() => members.memberId, { onDelete: "cascade" }),
  // An imported person's or an advisor's name; for a member, the record's
  // name, copied here when their account is anonymized (lib/dashboard/anonymize.ts).
  recordName: text("record_name"),
  // The name an editor fixed for the page; null shows the record's.
  name: text("name"),
  founder: alumniFounderEnum("founder"),
  // A public store URL, or a photo in public/team/.
  photo: text("photo"),
  shown: boolean("shown").default(true).notNull(),
  // They ticked "Remove my name from the Alumni page" (boards 55b, 55c).
  removedAt: timestamp("removed_at", { withTimezone: true, mode: "string" }),
  // An advisor's role on the page and the academic years they advised, as
  // the calendar year each year starts in.
  advisorRole: text("advisor_role"),
  advisorFrom: integer("advisor_from"),
  advisorTo: integer("advisor_to"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (table) => ({
  oneEntryPerMember: uniqueIndex("alumni_entries_member").on(table.memberId),
  memberKind: check("alumni_entries_member_kind", sql`(${table.kind} = 'member') = (${table.memberId} is not null)`),
  namedOthers: check("alumni_entries_named", sql`${table.kind} = 'member' or ${table.recordName} is not null`),
  advisorFields: check(
    "alumni_entries_advisor",
    sql`(${table.kind} = 'advisor') = (${table.advisorRole} is not null and ${table.advisorFrom} is not null and ${table.advisorTo} is not null)`,
  ),
}));

/** One line of an imported year (drizzle/0021): the group and role the old page gave, in its order. */
export const alumniImportedRoles = pgTable("alumni_imported_roles", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id")
    .references(() => alumniEntries.id, { onDelete: "cascade" })
    .notNull(),
  year: integer("year").notNull(),
  groupName: text("group_name").notNull(),
  role: text("role").notNull(),
  position: integer("position").notNull(),
}, (table) => ({
  entryIdx: index("alumni_imported_roles_entry_idx").on(table.entryId),
}));

/** The page's text for one person's role in one group of one year (board 78b). */
export const alumniRoleFixes = pgTable("alumni_role_fixes", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id")
    .references(() => alumniEntries.id, { onDelete: "cascade" })
    .notNull(),
  year: integer("year").notNull(),
  groupName: text("group_name").notNull(),
  role: text("role").notNull(),
}, (table) => ({
  oneFixPerLine: uniqueIndex("alumni_role_fixes_line").on(table.entryId, table.year, table.groupName),
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
    givenByActingAccount: actingAccount("given_by_acting_account"),
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

// The partners on /partners and the home logo strip (issue #256, boards 76
// and 76b). A partner is its place in the site order; what it shows lives in
// its versions: a published one, a draft, or both. Removing a partner removes
// its versions.
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  siteOrder: integer("site_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const partnerVersions = pgTable(
  "partner_versions",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .references(() => partners.id, { onDelete: "cascade" })
      .notNull(),
    version: contentVersionEnum("version").notNull(),
    name: text("name").notNull(),
    tier: partnerTierEnum("tier").notNull(),
    /** A file in public/design/sponsors/, or the logo's public Blob URL. */
    logoUrl: text("logo_url").notNull(),
    logoWidth: integer("logo_width").notNull(),
    logoHeight: integer("logo_height").notNull(),
    logoKind: partnerLogoKindEnum("logo_kind").notNull(),
    /** Measured on upload: too dark for the page, so the site draws it white. */
    logoDark: boolean("logo_dark").notNull(),
    website: text("website"),
    oneLiner: text("one_liner").notNull(),
    about: text("about"),
    support: text("support"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    oneOfEachVersion: unique("partner_versions_partner_version_unique").on(
      table.partnerId,
      table.version,
    ),
  }),
);

// The questions at the bottom of /apply (issue #258, boards 79 and 79b). A
// question is its place in the site order; what it says lives in its
// versions, as a partner's does: a published one, a draft, or both. Removing
// a question removes its versions.
export const faqs = pgTable("faqs", {
  id: serial("id").primaryKey(),
  siteOrder: integer("site_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const faqVersions = pgTable(
  "faq_versions",
  {
    id: serial("id").primaryKey(),
    faqId: integer("faq_id")
      .references(() => faqs.id, { onDelete: "cascade" })
      .notNull(),
    version: contentVersionEnum("version").notNull(),
    question: text("question").notNull(),
    /** One string per paragraph, at least one. */
    answer: text("answer").array().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    oneOfEachVersion: unique("faq_versions_faq_version_unique").on(
      table.faqId,
      table.version,
    ),
    // The panel's limit (lib/faq/faq.ts, FAQ_QUESTION_MAX), counted as characters.
    questionLength: check(
      "faq_versions_question_length",
      sql`char_length(${table.question}) between 1 and 120`,
    ),
    answered: check(
      "faq_versions_answered",
      sql`cardinality(${table.answer}) >= 1`,
    ),
  }),
);

// The tags an Outreach post can carry (issue #287): data, so the editor can
// add one. `award` marks the one tag whose posts the /outreach header counts
// as awards; the partial unique index keeps it to one. Posts point at a tag by
// its name, so renaming a tag renames it on every post.
export const outreachTags = pgTable(
  "outreach_tags",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique("outreach_tags_name_unique"),
    award: boolean("award").default(false).notNull(),
    /** Where the tag sits in the editor's tag list. */
    listOrder: integer("list_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    oneAward: uniqueIndex("outreach_tags_one_award")
      .on(table.award)
      .where(sql`${table.award}`),
    // The editor's limit (lib/outreach-editor.ts, OUTREACH_TAG_MAX).
    nameLength: check(
      "outreach_tags_name_length",
      sql`char_length(${table.name}) between 1 and 32`,
    ),
  }),
);

// The posts on /outreach and their pages (issue #287, boards 74 to 74h). A
// post is its place in the site order; what it shows lives in its versions,
// as a partner's does: a published one, a draft, or both. Removing a post
// removes its versions and their tags. `featured_slot` marks a post featured
// at the top of /outreach (issue #496, migration 0048): slot 1 or 2, each
// held by one post at most, so a third featured post cannot be stored; null
// for every other post.
export const outreachPosts = pgTable(
  "outreach_posts",
  {
    id: serial("id").primaryKey(),
    siteOrder: integer("site_order").notNull(),
    featuredSlot: smallint("featured_slot"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    featuredSlotValid: check("outreach_posts_featured_slot", sql`${table.featuredSlot} in (1, 2)`),
    oneEachFeaturedSlot: uniqueIndex("outreach_posts_featured_slot_unique").on(table.featuredSlot),
  }),
);

export const outreachPostVersions = pgTable(
  "outreach_post_versions",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .references(() => outreachPosts.id, { onDelete: "cascade" })
      .notNull(),
    version: contentVersionEnum("version").notNull(),
    title: text("title").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    place: text("place"),
    summary: text("summary").notNull(),
    /** The card's shorter summary on phones, when it has one. */
    summaryPhone: text("summary_phone"),
    lead: text("lead").notNull(),
    /** The body blocks in order (lib/outreach-rows.ts reads them back). */
    body: jsonb("body").notNull(),
    /** `{ src, alt }` in order; the first is the cover and the card photo. */
    photos: jsonb("photos").notNull(),
    /** Any of the channels (lib/outreach-types.ts), each `{ url, caption, account? }`; none at all is fine (issue #430). */
    channels: jsonb("channels").notNull(),
    /** `{ items: [{ src, alt, caption? }] }`; null for a post with no gallery photo (issues #430, #451). Rows saved before #451 may also hold `shown` and `title`, which reads ignore. */
    gallery: jsonb("gallery"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    oneOfEachVersion: unique("outreach_post_versions_post_version_unique").on(
      table.postId,
      table.version,
    ),
    // A published version is a whole post. A draft may not be one yet: Save
    // draft works at any point on a new post (board 74f, issue #292), so a
    // draft row may have no title, text, photo or channel. The editor keeps
    // a live post's draft whole (lib/content/versioned.ts, `Versioned`).
    titled: check(
      "outreach_post_versions_titled",
      sql`${table.version} = 'draft' or char_length(${table.title}) >= 1`,
    ),
    hasBody: check(
      "outreach_post_versions_body",
      sql`jsonb_typeof(${table.body}) = 'array' and (${table.version} = 'draft' or jsonb_array_length(${table.body}) >= 1)`,
    ),
    hasPhoto: check(
      "outreach_post_versions_photos",
      sql`jsonb_typeof(${table.photos}) = 'array' and (${table.version} = 'draft' or jsonb_array_length(${table.photos}) >= 1)`,
    ),
    // Original posts are optional (Owner decision, issue #430, migration 0045).
    channelsObject: check("outreach_post_versions_channels", sql`jsonb_typeof(${table.channels}) = 'object'`),
    galleryObject: check(
      "outreach_post_versions_gallery",
      sql`${table.gallery} is null or jsonb_typeof(${table.gallery}) = 'object'`,
    ),
  }),
);

// A post version's tags, in the order the post shows them. Each row belongs
// to one version and goes with it.
export const outreachPostTags = pgTable(
  "outreach_post_tags",
  {
    postId: integer("post_id").notNull(),
    version: contentVersionEnum("version").notNull(),
    tagName: text("tag_name")
      .references(() => outreachTags.name, { onUpdate: "cascade" })
      .notNull(),
    position: integer("position").notNull(),
  },
  (table) => ({
    pk: primaryKey({
      name: "outreach_post_tags_pk",
      columns: [table.postId, table.version, table.position],
    }),
    oneEach: unique("outreach_post_tags_once").on(
      table.postId,
      table.version,
      table.tagName,
    ),
    ofVersion: foreignKey({
      name: "outreach_post_tags_version_fk",
      columns: [table.postId, table.version],
      foreignColumns: [
        outreachPostVersions.postId,
        outreachPostVersions.version,
      ],
    }).onDelete("cascade"),
  }),
);

// The summit the team started, once featured above the posts (board 74's
// summit card). It left the product (issue #496): the featured posts are
// normal posts, and no code reads or writes this table. It is kept so no
// stored row is lost.
export const outreachSummitVersions = pgTable(
  "outreach_summit_versions",
  {
    version: contentVersionEnum("version").primaryKey(),
    eyebrow: text("eyebrow").notNull(),
    title: text("title").notNull(),
    story: text("story").notNull(),
    storyPhone: text("story_phone"),
    photoSrc: text("photo_src").notNull(),
    photoAlt: text("photo_alt").notNull(),
    /** `{ year, place }` oldest first; the first is the one the team started. */
    editions: jsonb("editions").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    hasEdition: check(
      "outreach_summit_versions_editions",
      sql`jsonb_typeof(${table.editions}) = 'array' and jsonb_array_length(${table.editions}) >= 1`,
    ),
  }),
);

// The Team page's visual layer (issue #283, ADR 0015): one document, kept as
// the published version /about/the-team lays on the roles build and an
// optional draft, one row each. It holds what an editor changed on the page
// (lib/about/team-layer.ts), never a role, division, department or access.
export const teamPageLayerVersions = pgTable("team_page_layer_versions", {
  id: serial("id").primaryKey(),
  version: contentVersionEnum("version").notNull().unique("team_page_layer_versions_version_unique"),
  layer: jsonb("layer").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// The Team page's advisors (issue #286): faculty and specialists added by
// hand, never from roles (lib/about/advisors.ts). One row per advisor with
// its site order, and one version row each for what the page shows and an
// optional draft, as `faqs` keeps its questions. Migration 0035 imports
// today's advisors as published.
export const teamPageAdvisors = pgTable("team_page_advisors", {
  id: serial("id").primaryKey(),
  siteOrder: integer("site_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const teamPageAdvisorVersions = pgTable(
  "team_page_advisor_versions",
  {
    id: serial("id").primaryKey(),
    advisorId: integer("advisor_id")
      .references(() => teamPageAdvisors.id, { onDelete: "cascade" })
      .notNull(),
    version: contentVersionEnum("version").notNull(),
    advisor: jsonb("advisor").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    oneOfEachVersion: unique("team_page_advisor_versions_advisor_version_unique").on(table.advisorId, table.version),
  }),
);

// The projects (issue #295, boards 75 to 75d): each project page, its
// /projects entry and its home card, read off one record. A project is its
// place in the site order; its record lives in its versions, as a partner's
// does: a published one, a draft, or both. The record is one JSON document
// (lib/project-content/record.ts, checked on every read), because its
// sections nest lists of their own. Removing a project removes its versions.
// Since page blocks (migration 0050) the record is in `page`, and `content`
// keeps the record from before them (lib/project-content/row.ts).
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  siteOrder: integer("site_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

export const projectVersions = pgTable(
  "project_versions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    version: contentVersionEnum("version").notNull(),
    /** The record from before page blocks, kept for code built then (lib/project-content/row.ts). */
    content: jsonb("content").notNull(),
    /** The page blocks record (migration 0050); null on a row written by code from before page blocks. */
    page: jsonb("page"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    oneOfEachVersion: unique("project_versions_project_version_unique").on(
      table.projectId,
      table.version,
    ),
    isRecord: check(
      "project_versions_content_is_record",
      sql`jsonb_typeof(${table.content}) = 'object'`,
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
  // The acting account when the write was made in a View as session (issue
  // #605): the audit trigger stores the `request.acting_account` setting
  // lib/db-audit.ts sets, so `changed_by` is the person viewed as and this
  // is who was viewing. Null outside View as.
  changedByActingAccount: actingAccount("changed_by_acting_account"),
  changedAt: timestamp("changed_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});

// The re-seed requests the shared `preview` branch has served (issue #595,
// ADR 0016 amendment of 2026-10-24). A preview build re-seeds the branch only
// for a `PREVIEW_RESEED_REQUEST` value this table does not hold yet, and
// records it in the same transaction, so one request runs once. It is the one
// table the re-seed keeps; no page reads or writes it.
export const previewReseeds = pgTable("preview_reseeds", {
  request: text("request").primaryKey(),
  reseededAt: timestamp("reseeded_at", {
    withTimezone: true,
    mode: "string",
  })
    .defaultNow()
    .notNull(),
});
