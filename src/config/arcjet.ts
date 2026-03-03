import arcjet, { shield, detectBot, tokenBucket, slidingWindow } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";

if (!process.env.ARCJET_KEY && process.env.NODE_ENV !== 'test') {
    throw new Error('ARCJET_KEY is required');
}

const aj = arcjet({
    key: process.env.ARCJET_KEY!,
    rules: [
        // Shield protects your app from common attacks e.g. SQL injection
        shield({ mode: "LIVE" }),
        // Create a bot detection rule
        detectBot({
            mode: "LIVE", // Blocks requests. Use "DRY_RUN" to log only
            // Block all bots except the following
            allow: [
                "CATEGORY:SEARCH_ENGINE",
                "CATEGORY:PREVIEW",
            ],
        }),
        slidingWindow({
            mode: 'LIVE',
            interval: '2',
            max: 5,
        })
    ],
});

export default aj;