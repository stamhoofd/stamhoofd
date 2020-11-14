import { Server } from '../classes/Server';

export function buildBackendEnv(server: Server): string {
    if (!server.config.backend) {
        throw new Error("Backend not configured for this server")
    }

    const base = server.config.backend.env

    // now add extra properties

    const env = Object.assign(base, {
        NODE_ENV: server.config.environment,

        HOSTNAME_API: server.config.domains.api,
        HOSTNAME_DASHBOARD: server.config.domains.dashboard,
        HOSTNAME_REGISTRATION: server.config.domains.registration,
        HOSTNAME_WEBSHOP: server.config.domains.webshop,
        PORT: 9091,

        DB_HOST: "localhost",
        DB_USER: "root",
        DB_PASS: "root",
        DB_DATABASE: "stamhoofd"
    });

    // Convert to string
    let str = ""
    for (const key in env) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const value: string | number = env[key]
        str += `${key}="${value}"\n`
    }
    return str
}