import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const betterAuthSchema = pgSchema("better_auth");

export const betterAuthUsers = betterAuthSchema.table(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull(),
    image: text("image"),
    createdAt: timestamp("createdAt", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    // Better Auth's admin plugin (issue #604, drizzle/0060). `role` is
    // "admin" only for a seeded admin tester, who may use View as on a
    // preview or under `next dev`; production reads the IT lead seat from
    // the roles instead (lib/dashboard/view-as.ts).
    role: text("role"),
    banned: boolean("banned").default(false),
    banReason: text("banReason"),
    banExpires: timestamp("banExpires", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => ({
    emailKey: uniqueIndex("user_email_key").on(table.email),
  }),
);

export const betterAuthAccounts = betterAuthSchema.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
      withTimezone: true,
      mode: "date",
    }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
      withTimezone: true,
      mode: "date",
    }),
    scope: text("scope"),
    password: text("password"),
    // The Google account's own email (issue #906, drizzle/0085_account_google_email.sql): set from the
    // id token Google sends when the account is linked and on each sign-in,
    // through Better Auth's `account.additionalFields` (lib/auth.ts). Null
    // only for a row no sign-in has set yet and the backfill could not fill.
    email: text("email"),
    createdAt: timestamp("createdAt", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => ({
    userIdIdx: index("account_userId_idx").on(table.userId),
  }),
);

export const betterAuthSessions = betterAuthSchema.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    // The acting account behind a View as session (issue #604, drizzle/0060);
    // null for a plain session. `userId` is the person viewed as.
    impersonatedBy: text("impersonatedBy"),
  },
  (table) => ({
    tokenKey: uniqueIndex("session_token_key").on(table.token),
    userIdIdx: index("session_userId_idx").on(table.userId),
  }),
);

export const betterAuthVerifications = betterAuthSchema.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("createdAt", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt", {
      withTimezone: true,
      mode: "date",
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
  }),
);
