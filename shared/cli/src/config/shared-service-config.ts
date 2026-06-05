import os from 'node:os';
import path from 'node:path';

export const successSymbol = '✓';

export const localIpv4Host = '127.0.0.1';
export const localIpv6Host = '::1';
export const defaultDomain = 'stamhoofd';
export const dockerHostGateway = 'host.docker.internal';

export const mysqlContainer = 'stamhoofd-mysql';
export const maildevContainer = 'stamhoofd-maildev';
export const rustfsContainer = 'stamhoofd-rustfs';
export const corednsContainer = 'stamhoofd-coredns';
export const caddyContainer = 'stamhoofd-caddy';

export const mysqlImage = 'docker.io/library/mysql:8.4';
export const maildevImage = 'docker.io/maildev/maildev:2.2.1';
export const rustfsImage = 'docker.io/rustfs/rustfs:latest';
export const corednsImage = 'docker.io/coredns/coredns:1.11.3';
export const caddyImage = 'docker.io/library/caddy:2';

export const mysqlRootUser = 'root';
export const mysqlRootPassword = 'root';
export const maildevUsername = 'username';
export const maildevPassword = 'password';
export const localFilesAccessKey = 'stamhoofd-local';
export const localFilesSecretKey = 'stamhoofd-local-secret';
export const localPrimaryBucket = 'stamhoofd-local';

export const mysqlInternalPort = 3306;
export const maildevInternalSmtpPort = 1025;
export const maildevInternalHttpPort = 1080;
export const rustfsInternalApiPort = 9000;
export const rustfsInternalConsolePort = 9001;
export const ssoInternalPort = 8080;

export const corednsPort = 53;
export const corednsUnprivilegedHostPort = 1053;
export const corednsPrivilegedHostPort = 53;
export const caddyHttpPort = 80;
export const caddyHttpsPort = 443;
export const caddyUnprivilegedHttpPort = 8080;
export const caddyUnprivilegedHttpsPort = 8443;
export const caddyAdminPort = 2020;
export const caddySetupAdminPort = 2021;
export const caddySetupHttpPort = 4080;
export const caddySetupHttpsPort = 4443;

export const mysqlDataVolume = 'stamhoofd-mysql-data';
export const rustfsDataVolume = 'stamhoofd-rustfs-data';
export const caddyConfigPath = '/etc/caddy/caddy.json';
export const caddyDataDirInContainer = '/data/caddy';

export function caddyDataDir(): string {
    // The Caddy Docker image sets XDG_DATA_HOME=/data, so it reads PKI data from
    // /data/caddy (= caddyDataDirInContainer). We mount the host Caddy data dir
    // there so the container shares the same CA as the local `caddy` binary.
    // On macOS the local binary uses ~/Library/Application Support/Caddy;
    // on Linux it follows XDG (~/.local/share/caddy).
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library/Application Support/Caddy');
    }
    const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local/share');
    return path.join(dataHome, 'caddy');
}

export function localhostPort(port: number): string {
    return `${localIpv4Host}:${port}`;
}

export function localhostPortMapping(hostPort: number, containerPort: number): string {
    return `${localIpv4Host}:${hostPort}:${containerPort}`;
}

export function localhostPortMappingDynamic(containerPort: number): string {
    return `${localIpv4Host}::${containerPort}`;
}
