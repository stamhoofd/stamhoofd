

export interface ServiceHelper {
    start(): Promise<ServiceProcess>
}

export type ServiceProcess = {
    caddyConfig?: {
        routes: any[],
        domains: string[]
    },
    wait: () => Promise<void>,
    kill?: () => Promise<void>
}
