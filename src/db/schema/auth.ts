import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Keep the same timestamps + $onUpdate pattern as `db/schema/app.ts`,
 * but match Better Auth's expected field names: `createdAt` / `updatedAt`.
 */
const timestamps = {
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
};

/**
 * Extra user field required by project:
 * - role: enum(student|teacher|admin), default student, NOT NULL
 */
export const roleEnum = pgEnum("role", ["student", "teacher", "admin"]);

/**
 * Better Auth core schema (PostgreSQL / Drizzle):
 * Tables: user, session, account, verification
 *
 * Notes:
 * - `user.id` must remain TEXT primary key (per your requirement).
 * - Column/property names match Better Auth core schema names exactly.
 * - Indexes and uniques added per your requirements:
 *   - index: session.userId, account.userId, verification.identifier
 *   - unique: session.token, account(providerId + accountId)
 */
export const user = pgTable(
    "user",
    {
        id: text("id").primaryKey(),

        name: text("name").notNull(),
        email: text("email").notNull().unique(),

        emailVerified: boolean("emailVerified").notNull().default(false),
        image: text("image"),

        // Extra fields (only these two are added)
        role: roleEnum("role").notNull().default("student"),
        imageCldPubId: text("imageCldPubId"),

        ...timestamps,
    },
    (t) => ({
        user_email_unique: uniqueIndex("user_email_unique").on(t.email),
    }),
);

export const session = pgTable(
    "session",
    {
        id: text("id").primaryKey(),

        userId: text("userId")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        token: text("token").notNull().unique(),

        expiresAt: timestamp("expiresAt").notNull(),

        ipAddress: text("ipAddress"),
        userAgent: text("userAgent"),

        ...timestamps,
    },
    (t) => ({
        session_userId_idx: index("session_userId_idx").on(t.userId),
        session_token_unique: uniqueIndex("session_token_unique").on(t.token),
    }),
);

export const account = pgTable(
    "account",
    {
        id: text("id").primaryKey(),

        userId: text("userId")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        accountId: text("accountId").notNull(),
        providerId: text("providerId").notNull(),

        accessToken: text("accessToken"),
        refreshToken: text("refreshToken"),

        accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
        refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),

        scope: text("scope"),
        idToken: text("idToken"),

        password: text("password"),

        ...timestamps,
    },
    (t) => ({
        account_userId_idx: index("account_userId_idx").on(t.userId),

        // Unique constraint “on account IDs” as expected by Better Auth:
        // an account is uniquely identified by (providerId, accountId).
        account_provider_account_unique: uniqueIndex("account_provider_account_unique").on(
            t.providerId,
            t.accountId,
        ),
    }),
);

export const verification = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),

        identifier: text("identifier").notNull(),
        value: text("value").notNull(),

        expiresAt: timestamp("expiresAt").notNull(),

        ...timestamps,
    },
    (t) => ({
        verification_identifier_idx: index("verification_identifier_idx").on(
            t.identifier,
        ),
    }),
);

/**
 * Relations (recommended when using Better Auth experimental joins).
 * - user has many sessions/accounts
 * - session/account belong to user
 * - verification is standalone in core schema (no userId)
 */
export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export type AuthUser = typeof user.$inferSelect;
export type NewAuthUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;