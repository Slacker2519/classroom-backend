import { pgTable, text, timestamp, boolean, pgEnum, index, uniqueIndex, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["student", "teacher", "admin"]);

const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull(),
    image: text("image"),
    role: roleEnum("role").default("student").notNull(),
    imageCldPubId: text("image_cld_pub_id"),
    ...timestamps
});

export const session = pgTable("session", {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
    index("session_user_id_idx").on(table.userId),
]);

export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId),
]);

export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
    index("verification_identifier_idx").on(table.identifier),
]);

export const apiKey = pgTable("api_key", {
    id: text("id").primaryKey(),
    name: text("name"),
    start: text("start"),
    key: text("key").notNull().unique(),
    referenceId: text("reference_id").notNull().references(() => user.id, { onDelete: 'cascade' }),
    prefix: text("prefix"),
    permissions: text("permissions"),
    requestCount: integer("request_count").notNull().default(0),
    configId: text("config_id"),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitMax: integer("rate_limit_max"),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    lastRequest: timestamp("last_request"),
    remaining: integer("remaining"),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    metadata: text("metadata"),
    enabled: boolean("enabled").default(true),
    expiresAt: timestamp("expires_at"),
    ...timestamps
});

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    apiKeys: many(apiKey),
}));

export const apiKeyRelations = relations(apiKey, ({ one }) => ({
    user: one(user, {
        fields: [apiKey.referenceId],
        references: [user.id],
    }),
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

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;