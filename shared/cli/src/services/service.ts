import type { CliContext } from '../context/create-context.js';

export type MaybePromise<T> = T | Promise<T>;

export type ServiceStatus = {
    name: string;
    running: boolean;
    detail: string;
    login?: string;
};

export type ServiceStartResult = {
    message: string;
    env?: NodeJS.ProcessEnv;
};

export type ServiceDefinition<TOptions = void> = {
    key: string;
    name: string;
    status(context: CliContext): Promise<ServiceStatus>;
    start(context: CliContext, options: TOptions): Promise<ServiceStartResult>;
    stop(context: CliContext): Promise<string>;
    logs?(context: CliContext): Promise<void>;
    getLogin?(context: CliContext): MaybePromise<string | undefined>;
    getContainer?(context: CliContext): string;
};

export type SharedServiceDefinition = ServiceDefinition<void>;
