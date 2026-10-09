import { buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import type { CliContext } from '../../context/create-context.js';
import { caddyRootCaPath, elasticmqUiContainer, elasticmqUiImage, elasticmqUiInternalPort, localIpv4Host, localhostPortMapping } from '../../config/shared-service-config.js';
import { link } from '../../runtime/ux.js';
import { SharedDockerService } from '../docker-service.js';

export class ElasticmqUiService extends SharedDockerService {
    readonly key = 'elasticmq-ui';
    readonly name = 'ElasticMQ UI';

    getContainer(): string {
        return elasticmqUiContainer;
    }

    getDetail(context: CliContext): string {
        const url = `https://${buildDomains(context).sqsUi}`;
        return link(url, url);
    }

    getDockerArgs(context: CliContext): string[] {
        return ElasticmqUiService.dockerArgs(buildPorts(context).elasticmqUi, buildDomains(context).sqs, caddyRootCaPath());
    }

    static dockerArgs(port: number, sqsHost: string, caPath: string, platform: NodeJS.Platform = process.platform): string[] {
        const hostNetwork = platform !== 'darwin';
        // The SDK follows the advertised HTTPS queue URLs, so the UI must trust and reach Caddy.
        return ['run', '-d', '--name', elasticmqUiContainer,
            ...(hostNetwork ? ['--network', 'host'] : ['-p', localhostPortMapping(port, elasticmqUiInternalPort)]),
            '--add-host', `${sqsHost}:${hostNetwork ? localIpv4Host : 'host-gateway'}`,
            '-v', `${caPath}:/opt/caddy-root.crt:ro`,
            '--security-opt', 'label=disable',
            '-e', 'NODE_EXTRA_CA_CERTS=/opt/caddy-root.crt',
            '-e', `SQS_ENDPOINT=https://${sqsHost}`,
            '-e', `HOSTNAME=${hostNetwork && !process.env.PUBLIC_IP ? localIpv4Host : '0.0.0.0'}`,
            '-e', `PORT=${hostNetwork ? port : elasticmqUiInternalPort}`,
            elasticmqUiImage];
    }
}

export const elasticmqUiService = new ElasticmqUiService();
