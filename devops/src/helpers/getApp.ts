export function getApp(): string | undefined {
    for (const [index, a] of process.argv.entries()) {
        if (a == "--app") {
            return process.argv[index + 1]
        }
    }
    return undefined
}