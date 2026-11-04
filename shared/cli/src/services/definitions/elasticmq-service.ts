import fs from 'node:fs/promises';
import path from 'node:path';
import { buildDomains } from '../../config/build-config.js';
import { buildPorts } from '../../context/ports.js';
import type { CliContext } from '../../context/create-context.js';
import { elasticmqContainer, elasticmqImage, elasticmqInternalPort, localhostPortMapping } from '../../config/shared-service-config.js';
import { sharedDir } from '../../runtime/manifest-store.js';
import { link } from '../../runtime/ux.js';
import { SharedDockerService } from '../docker-service.js';

export class ElasticmqService extends SharedDockerService<string> {
    readonly key = 'elasticmq';
    readonly name = 'ElasticMQ';

    getContainer(): string {
        return elasticmqContainer;
    }

    getDetail(context: CliContext): string {
        const url = `https://${buildDomains(context).sqs}`;
        return link(url, url);
    }

    async prepare(context: CliContext): Promise<string> {
        const config = path.join(sharedDir(context), 'elasticmq.conf');
        await fs.mkdir(path.dirname(config), { recursive: true });
        await fs.writeFile(config, ElasticmqService.config(buildDomains(context).sqs), { mode: 0o644 });
        return config;
    }

    getDockerArgs(context: CliContext, _options: void, config: string): string[] {
        return ['run', '-d', '--name', elasticmqContainer,
            '-p', localhostPortMapping(buildPorts(context).elasticmq, elasticmqInternalPort),
            '-v', `${config}:/opt/elasticmq.conf:ro,Z`, elasticmqImage];
    }

    static config(host: string): string {
        return `include classpath("application.conf")
node-address {
    protocol = https
    host = ${JSON.stringify(host)}
    port = 443
}
rest-sqs {
    enabled = true
    bind-hostname = "0.0.0.0"
    bind-port = ${elasticmqInternalPort}
}
generate-node-address = false
`;
    }
}

export const elasticmqService = new ElasticmqService();
