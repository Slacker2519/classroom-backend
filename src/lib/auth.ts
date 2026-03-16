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
if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not set");
}

async function sendInvitationEmail(data: {
    email: string;
    id: string;
    inviter: { user: { name: string; email: string } };
    organization: { name: string; logo?: string | null };
}) {
    const inviteLink = `${frontendUrl}/accept-invitation/${data.id}`;
    
    // console.log(`[DEBUG] Invitation email would be sent to: ${data.email}`);
    // console.log(`[DEBUG] Invite link: ${inviteLink}`);
}

export const auth = betterAuth({
    baseURL: betterAuthUrl,
    secret: betterAuthSecret,
    trustedOrigins: [frontendUrl],
    advanced: {
        cookiePrefix: "better-auth",
        useSecureCookies: true,
        defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
            httpOnly: true,
        },
        cookies: {
            session_token: {
                attributes: {
                    sameSite: "none",
                    secure: true,
                }
            }
        }
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
            async sendInvitationEmail(data) {
                await sendInvitationEmail(data);
            },
            creatorRole: "admin",
        }),
        apiKey({
            enableSessionForAPIKeys: true,
        }) as any,
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
