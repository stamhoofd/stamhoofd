import { Server } from '../classes/Server'

function getServerName(): string | undefined {
    for (const [index, a] of process.argv.entries()) {
        if (a == "--server") {
            return process.argv[index + 1]
        }
    }
    return undefined
}

export function getServer() {
    
    const name = getServerName()
    if (!name) {
        throw new Error("Expected server name as argument, e.g. --server test")
    }

    return Server.createFromName(name)
}