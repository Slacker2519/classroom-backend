import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { organization } from "better-auth/plugins";
import { db } from "../db/index.js";
import * as schema from "../db/schema/auth.js";
import { ac, roles } from "./access-control.js";

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
const betterAuthUrl = process.env.BETTER_AUTH_URL;
const frontendUrl = process.env.FRONTEND_URL;

if (!betterAuthSecret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
}
if (!betterAuthUrl) {
    throw new Error("BETTER_AUTH_URL is not set");
}
if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not set");
}

export const auth = betterAuth({
    baseURL: betterAuthUrl,
    secret: betterAuthSecret,
    trustedOrigins: [frontendUrl],
    advanced: {
        cookiePrefix: "better-auth",
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
        },
    },
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            ...schema,
            apikey: schema.apiKey,
        },
    }),
    plugins: [
        organization({
            ac,
            roles: {
                admin: roles.admin,
                teacher: roles.teacher,
                student: roles.student,
            },
            creatorRole: "admin",
        }),
        apiKey({
            enableSessionForAPIKeys: true,
        }),
    ],
    emailAndPassword: {
        enabled: true
    },
    user: {
        additionalFields: {
            role: {
                type: "string", required: true, default: "student", input: true,
            },
            imageCldPubId: {
                type: "string", required: false, input: true,
            }
        }
    }
});
