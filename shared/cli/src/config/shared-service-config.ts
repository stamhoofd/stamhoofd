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

/**
 * The Caddy config uses the `replace_response` handler (webshop strict-dynamic CSP nonce),
 * which is not part of the stock Caddy image. We build a small custom image on demand that
 * compiles those plugins in via xcaddy, starting from the official Caddy builder + runtime
 * images. `caddyImage` is the locally built tag; the `localhost/` prefix keeps it resolving
 * to the local image store under both Docker and Podman (never pulled from a registry).
 */
export const caddyBaseImage = 'docker.io/library/caddy:2';
export const caddyBuilderImage = 'docker.io/library/caddy:2-builder';
export const caddyImage = 'localhost/stamhoofd-caddy:2';
export const caddyPlugins = ['github.com/caddyserver/replace-response'];

export const mysqlRootUser = 'root';
export const mysqlRootPassword = 'root';
export const maildevUsername = 'username';
export const maildevPassword = 'password';
export const localFilesAccessKey = 'stamhoofd-local';
export const localFilesSecretKey = 'stamhoofd-local-secret';
export const localPrimaryBucket = 'stamhoofd-local';

export const defaultMysqlInnodbBufferPoolSize = '4G';
export const defaultInnodbBufferPoolInstances = '4';
export const defaultMysqlSortBufferSize = '2M';

/**
 * Build the MySQL server arguments passed to the Docker container.
 *
 * The InnoDB buffer pool and sort buffer sizes can be tuned through the
 * STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_SIZE and STAMHOOFD_MYSQL_SORT_BUFFER_SIZE
 * environment variables (e.g. "512M", "1G"), falling back to safe defaults.
 */
export function mysqlServerArgs(): string[] {
    const innodbBufferPoolSize = process.env.STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_SIZE ?? defaultMysqlInnodbBufferPoolSize;
    const bufferPoolInstances = process.env.STAMHOOFD_MYSQL_INNODB_BUFFER_POOL_INSTANCES ?? defaultInnodbBufferPoolInstances;
    const sortBufferSize = process.env.STAMHOOFD_MYSQL_SORT_BUFFER_SIZE ?? defaultMysqlSortBufferSize;

    return [
        '--mysql-native-password=ON',
        `--innodb-buffer-pool-size=${innodbBufferPoolSize}`,
        `--innodb-buffer-pool-instances=${bufferPoolInstances}`,
        `--sort-buffer-size=${sortBufferSize}`,
    ];
}

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
export const caddyAdminPort = 2019;
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

export function caddyRootCaPath(): string {
    return path.join(caddyDataDir(), 'pki/authorities/local/root.crt');
}

export function localhostPort(port: number): string {
    return `${localIpv4Host}:${port}`;
}

export function localhostPortMapping(hostPort: number, containerPort: number): string {
    if (process.env.PUBLIC_IP) {
        return `0.0.0.0:${hostPort}:${containerPort}`;
    }
    return `${localIpv4Host}:${hostPort}:${containerPort}`;
}

export function localhostPortMappingDynamic(containerPort: number): string {
    return `${localIpv4Host}::${containerPort}`;
}
