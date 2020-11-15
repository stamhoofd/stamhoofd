/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { promises as fs } from "fs"
import { NodeSSH, SSHExecOptions } from "node-ssh"
import os from "os";
const homedir = os.homedir();

export interface ServerConfig {
    ssh: {
        user: string,
        ip: string,
    },
    frontend?: {
        apps: ("dashboard" | "registration" | "webshop")[]
    },
    environment: "staging" | "production" | "development",
    backend?: {
        env: {
            SMTP_HOST: string,
            SMTP_USERNAME: string,
            SMTP_PASSWORD: string,
            SMTP_PORT: number,

            // AWS
            AWS_ACCESS_KEY_ID: string,
            AWS_SECRET_ACCESS_KEY: string,
            AWS_REGION: "eu-west-1" | string, // todo: add others

            // DO spaces
            SPACES_ENDPOINT: string,
            SPACES_BUCKET: string,
            SPACES_KEY: string,
            SPACES_SECRET: string,

            // Mollie
            MOLLIE_CLIENT_ID: string,
            MOLLIE_SECRET: string
        }
    },
    domains: {
        dashboard: string,
        registration: string,   // requires wildcard prefix DNS
        webshop: string,       // requires wildcard prefix DNS
        api: string, // requires wildcard prefix DNS
    }
}

export class Server {
    config: ServerConfig;
    connection: NodeSSH | null = null
    verbose = true

    constructor(config: ServerConfig) {
        this.config = config
    }

    static async createFromName(name: string): Promise<Server> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
        const config = (await import(__dirname+"/../servers/"+name+".js")).default 
        return new Server(config)
    }

    async createConnection(user?: string) {
        const ssh = new NodeSSH();
        await ssh.connect({
            host: this.config.ssh.ip,
            username: user ?? this.config.ssh.user,
            privateKey: homedir+'/.ssh/id_rsa'
        })
        console.log("Connected.")
        return ssh
    }

    disconnect() {
        if (this.connection) {
            this.connection.dispose()
            this.connection = null
        }
    }

    async connectAs(user: string) {
        this.disconnect();
        this.connection = await this.createConnection(user)
        return this.connection
    }

    async getConnection() {
        if (this.connection) {
            return this.connection
        }
        this.connection = await this.createConnection()
        return this.connection
    }

    /**
     * Execute a command on this server, as the normal user
     */
    async execCommand(cmd: string, options?: any) {
        const ssh = await this.getConnection()
        const result = await ssh.execCommand(cmd, options);
        if (result.code !== 0 && result.code !== null) {
            console.error(result.stdout)
            console.error(result.stderr)
            throw new Error(`Cmd '${cmd}' failed: ${result.code}`)
        }

        if (this.verbose) {
            console.error(result.stdout)
            console.error(result.stderr)
        }
    }

    /**
     * Execute a command on this server, with parameters, as the normal user
     */
    async exec(cmd: string, params, options?: SSHExecOptions) {
        const ssh = await this.getConnection()
        const bothOptions = Object.assign({}, options, { stream: "both" as const })

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = await ssh.exec(cmd, params, bothOptions);
        if (result.code !== 0 && result.code !== null) {
            console.error(result.stdout)
            console.error(result.stderr)
            throw new Error(`Cmd '${cmd}' failed: ${result.code}`)
        }
        if (this.verbose) {
            console.error(result.stdout)
            console.error(result.stderr)
        }
    }
}