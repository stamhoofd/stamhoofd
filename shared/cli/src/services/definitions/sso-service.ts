import { buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import { localIpv4Host, ssoInternalPort } from '../../config/shared-service-config.js';
import type { CliContext } from '../../context/create-context.js';
import { DockerService } from '../docker-service.js';
import { ssoAdminPassword, ssoAdminUser, writeKeycloakRealm } from '../sso-config.js';

type SsoStartOptions = {
    redirectUri: string;
    background?: boolean;
};

type SsoPrepared = {
    importDir: string;
};

export class SsoService extends DockerService<SsoStartOptions, SsoPrepared> {
    readonly key = 'sso';
    readonly name = 'SSO';
    override readonly runQuiet = false;

    getContainer(context: CliContext): string {
        return SsoService.container(context);
    }

    getDetail(context: CliContext): string {
        const domains = buildDomains(context);
        return `https://${domains.sso}/dex/admin`;
    }

    async prepare(context: CliContext, options: SsoStartOptions): Promise<SsoPrepared> {
        return { importDir: await writeKeycloakRealm(context, options.redirectUri) };
    }

    canReuse(): boolean {
        return false;
    }

    getDockerArgs(context: CliContext, options: SsoStartOptions, prepared: SsoPrepared): string[] {
        const domains = buildDomains(context);
        const ports = buildPorts(context);
        const args = ['run'];
        if (options.background) {
            args.push('-d');
        }
        else {
            args.push('--rm');
        }
        args.push('--name', SsoService.container(context), '-p', `${localIpv4Host}:${ports.sso}:${ssoInternalPort}`, '-e', `KC_BOOTSTRAP_ADMIN_USERNAME=${ssoAdminUser}`, '-e', `KC_BOOTSTRAP_ADMIN_PASSWORD=${ssoAdminPassword}`, '-e', 'KC_HTTP_RELATIVE_PATH=/dex', '-v', `${prepared.importDir}:/opt/keycloak/data/import:ro`, 'quay.io/keycloak/keycloak:26.0.7', 'start-dev', '--import-realm', '--hostname', `https://${domains.sso}/dex`, '--proxy-headers=xforwarded');
        return args;
    }

    static container(context: { instance: { name: string } }): string {
        return `${context.instance.name}-keycloak`;
    }
}

export const ssoService = new SsoService();
