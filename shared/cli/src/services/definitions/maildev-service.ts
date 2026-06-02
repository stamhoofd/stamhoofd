import { buildPorts } from '../../context/ports.js';
import { defaultDomain, maildevContainer, maildevImage, maildevInternalHttpPort, maildevInternalSmtpPort, maildevPassword, maildevUsername, localhostPortMapping } from '../../config/shared-service-config.js';
import { link } from '../../runtime/ux.js';
import { SharedDockerService } from '../docker-service.js';
import type { CliContext } from '../../context/create-context.js';

export class MaildevService extends SharedDockerService {
    static readonly container = maildevContainer;

    readonly key = 'maildev';
    readonly name = 'MailDev';

    getContainer(): string {
        return MaildevService.container;
    }

    getDetail(): string {
        const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
        return link(`https://mail.${domain}`, `https://mail.${domain}`);
    }

    getLogin(): string {
        return `${maildevUsername} / ${maildevPassword}`;
    }

    getDockerArgs(context: CliContext): string[] {
        const ports = buildPorts(context);
        return MaildevService.dockerArgs(ports.maildevSmtp, ports.maildevHttp);
    }

    static dockerArgs(smtpPort: number, httpPort: number): string[] {
        return ['run', '-d', '--name', MaildevService.container, '-p', localhostPortMapping(smtpPort, maildevInternalSmtpPort), '-p', localhostPortMapping(httpPort, maildevInternalHttpPort), maildevImage, 'maildev', '--ip', '0.0.0.0', '--incoming-user', maildevUsername, '--incoming-pass', maildevPassword];
    }
}

export const maildevService = new MaildevService();
