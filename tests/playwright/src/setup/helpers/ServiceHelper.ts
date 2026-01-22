export interface ServiceHelper {
    start(): Promise<ServiceProcess>;
}

export type ServiceProcess = {
    wait: () => Promise<void>;
    kill?: () => Promise<void>;
};
