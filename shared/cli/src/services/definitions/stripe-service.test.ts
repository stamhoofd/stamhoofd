import { afterEach, expect, it, vi } from 'vitest';
import type { CliContext } from '../../context/create-context.js';
import { RunVerbosity } from '../../runtime/command-runner.js';
import { DockerService } from '../docker-service.js';
import * as docker from '../docker.js';
import { StripeService } from './stripe-service.js';

afterEach(() => vi.restoreAllMocks());

it('keeps Stripe API key commands quiet', async () => {
    const context = { verbosity: RunVerbosity.Output } as CliContext;
    const start = vi.spyOn(DockerService.prototype, 'start').mockResolvedValue({ message: 'started' });
    const run = vi.spyOn(docker, 'run').mockResolvedValue({ stdout: 'whsec_test\n', stderr: '', status: 0 });

    await new StripeService().start(context, undefined);
    await StripeService.fetchWebhookSecret(context, 'sk_test');

    expect(start).toHaveBeenCalledWith({ verbosity: RunVerbosity.Quiet }, undefined);
    expect(run).toHaveBeenCalledWith(expect.arrayContaining(['--api-key', 'sk_test']), { capture: true, verbosity: RunVerbosity.Quiet });
});
