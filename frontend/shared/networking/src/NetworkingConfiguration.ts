import type { SimpleErrors } from '@common/errors';

export type NetworkingConfiguration = {
    getRequestHeaders(): Promise<Record<string, string>>;
    onClientUpdateRequired(error: SimpleErrors): void;
    onNewerVersion(version: number): void;
};

let configuration: NetworkingConfiguration | undefined;

/** Install callbacks before the first request; metadata is read for every attempt. */
export function configureNetworking(callbacks: NetworkingConfiguration) {
    configuration = callbacks;
}

export function getNetworkingConfiguration(): NetworkingConfiguration {
    if (!configuration) {
        throw new Error('Configure networking before making requests');
    }
    return configuration;
}
