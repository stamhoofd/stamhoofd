import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CliContext } from '../context/create-context.js';
import * as docker from './docker.js';
import { ContainerStoppedError, DockerService } from './docker-service.js';
import type { ServiceStatus } from './service.js';

vi.mock('./docker.js', () => ({
    containerIsRunning: vi.fn(),
    getContainerLogs: vi.fn(),
    removeContainer: vi.fn(),
    requireDocker: vi.fn(),
    run: vi.fn(),
}));

const context = {
    verbose: false,
} as CliContext;

class TestService extends DockerService<void, { token: string }> {
    readonly key = 'test';
    readonly name = 'Test';
    readonly calls: string[] = [];

    getContainer(): string {
        return 'test-container';
    }

    getDetail(): string {
        return 'localhost';
    }

    prepare(_context: CliContext, _options: void, _status: ServiceStatus): { token: string } {
        this.calls.push('prepare');
        return { token: 'prepared' };
    }

    beforeRun(): void {
        this.calls.push('beforeRun');
    }

    getDockerArgs(_context: CliContext, _options: void, prepared: { token: string }): string[] {
        this.calls.push('getDockerArgs');
        return ['run', '--name', 'test-container', 'image', prepared.token];
    }

    afterRun(): void {
        this.calls.push('afterRun');
    }

    getEnv(): NodeJS.ProcessEnv {
        return { TEST_ENV: '1' };
    }
}

class NoLogsService extends TestService {
    override readonly logsEnabled = false;
}

describe('DockerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the default already running message when the container can be reused', async () => {
        vi.mocked(docker.containerIsRunning).mockResolvedValue(true);
        const service = new TestService();

        const result = await service.start(context, undefined);

        expect(result).toEqual({ message: 'Test already running' });
        expect(docker.requireDocker).toHaveBeenCalledOnce();
        expect(docker.removeContainer).not.toHaveBeenCalled();
        expect(docker.run).not.toHaveBeenCalled();
        expect(service.calls).toEqual(['prepare']);
    });

    it('runs the container with hooks in order and returns env', async () => {
        vi.mocked(docker.containerIsRunning).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const service = new TestService();

        const result = await service.start(context, undefined);

        expect(result).toEqual({
            message: 'Test started',
            env: { TEST_ENV: '1' },
        });
        expect(docker.requireDocker).toHaveBeenCalledOnce();
        expect(docker.removeContainer).toHaveBeenCalledWith('test-container', false);
        expect(docker.run).toHaveBeenCalledWith(['run', '--name', 'test-container', 'image', 'prepared'], { quiet: true, verbose: false });
        expect(service.calls).toEqual(['prepare', 'beforeRun', 'getDockerArgs', 'afterRun']);
    });

    it('throws with the last log line when the container stops immediately', async () => {
        vi.mocked(docker.containerIsRunning).mockResolvedValue(false);
        vi.mocked(docker.getContainerLogs).mockResolvedValue('first line\nlast line');

        await expect(new TestService().start(context, undefined)).rejects.toMatchObject<Partial<ContainerStoppedError>>({
            serviceName: 'Test',
            tableDetail: 'last line',
            logs: 'first line\nlast line',
        });
    });

    it('tails logs by default and no-ops when logs are disabled', async () => {
        await new TestService().logs(context);
        expect(docker.run).toHaveBeenCalledWith(['logs', '-f', 'test-container'], { allowFailure: true });

        vi.clearAllMocks();
        await new NoLogsService().logs(context);
        expect(docker.run).not.toHaveBeenCalled();
    });
});
