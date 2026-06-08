export interface ServiceHelper {
    start(): Promise<ServiceProcess>;
}

export type ServiceProcess = {
    readonly name: string;
    wait: () => Promise<void>;
    kill?: () => Promise<void>;
};
