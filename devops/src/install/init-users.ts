import { Server } from "../classes/Server";
import { getServer } from '../helpers/getServer';

// Add a restricted user
export async function createUser(server: Server, oldUserName) {
    const username = server.config.ssh.user;

    let oldHome: string
    if (oldUserName == "root") {
        oldHome = "/root"
    } else {
        oldHome = "/home/"+oldUserName
    }

    await server.connectAs(oldUserName)

    console.log("Adding user...")
    
    await server.execCommand("adduser "+username+" --disabled-password --gecos ''")

    console.log("Adding user to sudo group...")
    await server.execCommand(`usermod -aG sudo ${username}`)

    // Create home etc
    console.log("Create home")
    await server.execCommand(`mkdir -p /home/${username}/.ssh && cp -r ${oldHome}/.ssh/. /home/${username}/.ssh && chown -R "${username}:${username}" "/home/${username}/.ssh" && chmod -R u=rw,g=o= "/home/${username}/.ssh/"* && chmod u=rwx,g=o= "/home/${username}/.ssh"`)

    console.log("Sudoers file")
    await server.execCommand(`echo "${username} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/99-${username} && chmod u=r,g=r,o= /etc/sudoers.d/99-${username}`)

    // Discard current connection
    await server.disconnect()
}

export async function disableRootLogin(server: Server) {
    // Disable root access (todo)
    await server.execCommand("sudo sed -i 's/#\\?\\(PermitRootLogin\\s*\\).*$/\\1 no/' /etc/ssh/sshd_config")
    await server.execCommand("sudo service ssh restart")
    await server.disconnect()
}


/**
 * Create the initial user on this server and disable root access
 */
export async function initUsers() {
    // Create a user
    const server = await getServer()
    await createUser(server, "root");
    await disableRootLogin(server);

    await server.disconnect();
}


initUsers()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch(err => console.error(err));