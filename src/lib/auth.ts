import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/schema/auth.js";

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
const frontendUrl = process.env.FRONTEND_URL;

if (!betterAuthSecret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
}
if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not set");
}

export const auth = betterAuth({
    secret: betterAuthSecret,
    trustedOrigins: [frontendUrl],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema,
    }),
    emailAndPassword: {
        enabled: true,
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