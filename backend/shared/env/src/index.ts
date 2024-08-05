import fs from "fs"
import crypto from 'crypto';

export function load(settings?: { path?: string, service?: "redirecter" | "api" | "admin" | "renderer" }) {
    // Read environment from file: .env.json
    (global as any).STAMHOOFD = JSON.parse(fs.readFileSync(settings?.path ?? ".env.json", "utf-8"))

    // Mapping out environment for dependencies that need environment variables
    process.env.NODE_ENV = STAMHOOFD.environment === "production" ? "production" : "development"

    if (settings?.service === "redirecter") {
        return
    }
    if (settings?.service === "renderer") {
        return
    }

    if (!STAMHOOFD.domains) {
        throw new Error("Expected environment variable domains")
    }

    if (!STAMHOOFD.userMode || !['platform', 'organization'].includes(STAMHOOFD.userMode)) {
        throw new Error("Expected environment variable userMode")
    }

    if (!STAMHOOFD.translationNamespace) {
        throw new Error("Expected environment variable translationNamespace")
    }

    // Database
    process.env.DB_DATABASE = STAMHOOFD.DB_DATABASE+""
    process.env.DB_HOST = STAMHOOFD.DB_HOST+""
    process.env.DB_PASS = STAMHOOFD.DB_PASS+""
    process.env.DB_USER = STAMHOOFD.DB_USER+""

    // AWS
    process.env.AWS_ACCESS_KEY_ID = STAMHOOFD.AWS_ACCESS_KEY_ID+""
    process.env.AWS_SECRET_ACCESS_KEY = STAMHOOFD.AWS_SECRET_ACCESS_KEY+""
    process.env.AWS_REGION = STAMHOOFD.AWS_REGION+""

    // Database
    process.env.DB_MULTIPLE_STATEMENTS="true"

    process.env.STRIPE_CONNECT_METHOD = STAMHOOFD.STRIPE_CONNECT_METHOD ?? "express"
}

export function signInternal(...content: string[]) {
    return crypto.createHmac('sha256', Buffer.from(STAMHOOFD.INTERNAL_SECRET_KEY, 'base64')).update(content.join(';')).digest('base64');
}

export function verifyInternalSignature(signature: string, ...content: string[]) {
    const newSignature = signInternal(...content)
    return crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(newSignature, 'base64'))
}
