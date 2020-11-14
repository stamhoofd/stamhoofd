import { Server } from '../classes/Server';
export const loadNVM = 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && [ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"';

async function installBashRc(server: Server) {
    // add loadNVM to top of bashrc to also load it for remote scripts...
    const dangerBase64 = Buffer.from(`export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"  # This loads nvm
    [ -s "$NVM_DIR/bash_completion" ] && \\. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
    export PATH="$(yarn global bin):$PATH"
    `).toString('base64');
    await server.execCommand(`echo "$(echo ${dangerBase64} | base64 -d)$(cat ~/.bashrc)" > ~/.bashrc`);
}

export async function installNode(server: Server): Promise<void> {
    await server.execCommand("curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.0/install.sh | bash");
    await server.execCommand(loadNVM+' && nvm install node && npm install -g yarn');
    await installBashRc(server)

    // Force reconnect after this
    server.disconnect()
}

export async function installPm2(server: Server): Promise<void> {
    await server.execCommand("yarn global add pm2");
}