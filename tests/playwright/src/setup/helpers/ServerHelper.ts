export interface ServerHelper {
    start(serverId: string): Promise<{
        caddyRoutes: any[],
        wait: () => Promise<void>,
        kill: () => Promise<void>
    }>
}
