import fs from "fs"

export function load(settings?: { path?: string }) {
    // Read environment from file: .env.json
    (global as any).STAMHOOFD = JSON.parse(fs.readFileSync(settings?.path ?? ".env.json", "utf-8"))

    if (!STAMHOOFD.domains.registration) {
        throw new Error("Expected environment variable domains.registration")
    }

    // Mapping out environment for dependencies that need environment variables
    process.env.NODE_ENV = STAMHOOFD.environment === "production" ? "production" : "development"

    // Database
    process.env.DB_DATABASE = STAMHOOFD.DB_DATABASE+""
    process.env.DB_HOST = STAMHOOFD.DB_HOST+""
    process.env.DB_PASS = STAMHOOFD.DB_PASS+""
    process.env.DB_USER = STAMHOOFD.DB_USER+""

    // AWS
    process.env.AWS_ACCESS_KEY_ID = STAMHOOFD.AWS_ACCESS_KEY_ID+""
    process.env.AWS_SECRET_ACCESS_KEY = STAMHOOFD.AWS_SECRET_ACCESS_KEY+""
    process.env.AWS_REGION = STAMHOOFD.AWS_REGION+""

    if (STAMHOOFD.environment !== "development" && STAMHOOFD.environment !== "test") {
        throw new Error("Non-development environment temporary disabled")
    }
}
