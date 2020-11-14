import { NodeSSH } from "node-ssh"
const homedir = require('os').homedir();
import { promises as fs } from "fs"

export class Server {
    config: any;
    connection: NodeSSH | null = null
    verbose = true

    constructor(config: any) {
        this.config = config
    }

    static async createFromName(name: string) {
        const config = (await import(__dirname+"/../servers/"+name+".js")).default as any
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

    async disconnect() {
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
    async execCommand(cmd, options?: any) {
        const ssh = await this.getConnection()
        const result = await ssh.execCommand(cmd, options);
        if (result.code !== 0 && result.code !== null) {
            console.error(result.stdout)
            console.error(result.stderr)
            throw new Error("Cmd '"+cmd+"' failed: "+result.code)
        }

        if (this.verbose) {
            console.error(result.stdout)
            console.error(result.stderr)
        }
        
    }

    /**
     * Execute a command on this server, with parameters, as the normal user
     */
    async exec(ssh, cmd, params, options?: any) {
        options.stream = "both" // prevent errors
        const result = await ssh.exec(cmd, params, options);
        if (result.code !== 0 && result.code !== null) {
            console.error(result.stdout)
            console.error(result.stderr)
            throw new Error("Cmd '"+cmd+"' failed: "+result.code)
        }
        if (this.verbose) {
            console.error(result.stdout)
            console.error(result.stderr)
        }
    }
}