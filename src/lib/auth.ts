import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { apiKey } from "@better-auth/api-key";
import { organization } from "better-auth/plugins";
import { db } from "../db/index.js";
import * as schema from "../db/schema/auth.js";
import { ac, roles } from "./access-control.js";

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
const betterAuthUrl = process.env.BETTER_AUTH_URL;
const frontendUrl = process.env.BETTER_AUTH_URL;

if (!betterAuthSecret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
}
if (!frontendUrl) {
    throw new Error("FRONTEND_URL is not set");
}

/**
 * Send organization invitation email
 * This is a placeholder - implement your actual email sending logic
 */
async function sendInvitationEmail(data: {
    email: string;
    id: string;
    inviter: { user: { name: string; email: string } };
    organization: { name: string; logo?: string };
}) {
    const inviteLink = `${frontendUrl}/accept-invitation/${data.id}`;
    
    // TODO: Implement your email sending logic here
    // Example: await sendEmail({
    //   to: data.email,
    //   subject: `Invitation to join ${data.organization.name}`,
    //   html: `<p>You have been invited by ${data.inviter.user.name} to join ${data.organization.name}. <a href="${inviteLink}">Accept Invitation</a></p>`
    // });
    
    console.log(`[DEBUG] Invitation email would be sent to: ${data.email}`);
    console.log(`[DEBUG] Invite link: ${inviteLink}`);
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
            // Set the creator role to admin (instead of owner)
            // This means the user who creates the organization gets admin role
            creatorRole: "admin",
            // Limit membership to 100 per organization (default)
            membershipLimit: 100,
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
                type: "string", required: true, input: true,
            },
            imageCldPubId: {
                type: "string", required: false, input: true,
            }
        }
    }
});
