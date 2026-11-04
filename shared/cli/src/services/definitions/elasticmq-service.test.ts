import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../../context/create-context.js';
import { ElasticmqService } from './elasticmq-service.js';
import { ElasticmqUiService } from './elasticmq-ui-service.js';

afterEach(() => vi.unstubAllEnvs());

describe('ElasticMQ', () => {
    it('advertises the shared HTTPS endpoint while binding the configured local port', async () => {
        vi.stubEnv('STAMHOOFD_DOMAIN', 'custom.local');
        vi.stubEnv('ELASTICMQ_PORT', '19324');
        vi.stubEnv('PUBLIC_IP', '');
        const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stamhoofd-elasticmq-'));
        const context = {
            rootDir,
            generatedDir: rootDir,
            env: 'stamhoofd',
            instance: { name: 'feature', prefix: 'feature', primary: false, portOffset: 100 },
        } as CliContext;
        try {
            const service = new ElasticmqService();
            const config = await service.prepare(context);
            const content = await fs.readFile(config, 'utf8');
            expect(content).toContain('host = "queues.custom.local"');
            expect(content).toContain('protocol = https');
            expect(content).toContain('port = 443');
            expect(content).toContain('bind-port = 9324');
            expect(content).toContain('generate-node-address = false');
            expect(service.getDockerArgs(context, undefined, config)).toContain('127.0.0.1:19324:9324');
            expect(service.getDetail(context)).toContain('https://queues.custom.local');
            expect(new ElasticmqUiService().getDetail(context)).toContain('https://ui.queues.custom.local');
        }
        finally {
            await fs.rm(rootDir, { recursive: true, force: true });
        }
    });

    it.each(['linux', 'darwin'] as const)('connects the UI to trusted HTTPS on %s', (platform) => {
        vi.stubEnv('PUBLIC_IP', '');
        const args = ElasticmqUiService.dockerArgs(19325, 'queues.custom.local', '/cert/root.crt', platform);
        expect(args).toContain('SQS_ENDPOINT=https://queues.custom.local');
        expect(args).toContain('NODE_EXTRA_CA_CERTS=/opt/caddy-root.crt');
        expect(args).toContain('/cert/root.crt:/opt/caddy-root.crt:ro');
        if (platform === 'linux') {
            expect(args).toContain('--network');
            expect(args).toContain('host');
            expect(args).toContain('queues.custom.local:127.0.0.1');
            expect(args).toContain('HOSTNAME=127.0.0.1');
            expect(args).toContain('PORT=19325');
        }
        else {
            expect(args).toContain('127.0.0.1:19325:3000');
            expect(args).toContain('queues.custom.local:host-gateway');
            expect(args).toContain('HOSTNAME=0.0.0.0');
            expect(args).toContain('PORT=3000');
        }
    });
});
