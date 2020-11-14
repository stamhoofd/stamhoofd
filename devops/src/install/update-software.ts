import { Server } from '../classes/Server';
import { sleep } from '../helpers/sleep';

export async function updateSoftware(server: Server, reboot = false): Promise<void> {
    await server.execCommand("sudo apt-get update -y && sudo apt-get upgrade -y")
    console.log("best to run 'sudo dpkg-reconfigure -plow unattended-upgrades' manually")

    console.log("Restarting...")
    await server.execCommand("sudo reboot")
    server.disconnect();

    await sleep(20*1000);
}