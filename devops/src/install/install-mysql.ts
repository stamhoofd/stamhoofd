import { Server } from '../classes/Server';

export async function installMySQL(server: Server): Promise<void> {
    await server.execCommand("sudo apt update && sudo apt install mysql-server -y");
    console.log("Please run 'sudo mysql_secure_installation' manually")

    // Force reconnect after this
    server.disconnect()
}