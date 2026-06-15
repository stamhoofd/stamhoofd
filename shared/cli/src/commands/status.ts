import path from 'node:path';
import { Flags } from '@oclif/core';
import { BaseCommand } from '../base-command.js';
import { localFilesAccessKey, localFilesSecretKey, maildevPassword, maildevUsername, successSymbol } from '../config/shared-service-config.js';
import { getProjectPath } from '../context/project-path.js';
import { listActiveInstanceManifests } from '../runtime/manifest-store.js';
import { printSharedServicesStatus } from '../services/shared-services.js';
import { link } from '../runtime/ux.js';
import { checkNodeVersion, printNodeVersionStatus } from '../workflows/setup-node.js';

export default class Status extends BaseCommand {
    static summary = 'Show local development status';
    static description = 'Use this for a quick overview of what is already running, which instances are active, and which URLs and logins are available.';
    static examples = [
        'stam status',
        'stam status --current',
        'stam status --watch',
    ];

    static flags = { ...BaseCommand.verboseFlags, current: Flags.boolean({ default: false, description: 'Only show the inferred current instance' }), watch: Flags.boolean({ default: false, description: 'Refresh the status view until interrupted' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(Status);
        const rootDir = path.resolve(getProjectPath());
        const nodeCheck = await checkNodeVersion(rootDir);
        printNodeVersionStatus(nodeCheck);
        this.log('');

        const context = await this.createContext({ verbose: flags.verbose });
        if (flags.watch) {
            while (true) {
                process.stdout.write('\x1Bc');
                await this.printStatus(context, flags.current);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        await this.printStatus(context, flags.current);
    }

    private async printStatus(context: Awaited<ReturnType<Status['createContext']>>, current: boolean): Promise<void> {
        await printSharedServicesStatus(context);
        const instances = await listActiveInstanceManifests(context);
        const visible = current ? instances.filter(instance => instance.name === context.instance.name) : instances;
        this.log('\nActive instances:');
        if (visible.length === 0) {
            this.log('  none');
            this.printCredentials();
            return;
        }
        for (const instance of visible) {
            this.log(`  ${successSymbol} ${instance.name}`);
            this.log(`    Env:       ${instance.env}`);
            this.log(`    Workspace: ${instance.workspace}`);
            this.log(`    Dashboard: ${link(`https://${instance.domains.dashboard}`, `https://${instance.domains.dashboard}`)}`);
            this.log(`    API:       ${link(`https://${instance.domains.api}`, `https://${instance.domains.api}`)}`);
        }
        this.printCredentials();
    }

    private printCredentials(): void {
        this.log('\nCredentials:');
        this.log(`  MailDev:  ${maildevUsername} / ${maildevPassword}`);
        this.log(`  Files UI: ${localFilesAccessKey} / ${localFilesSecretKey}`);
        this.log('  SSO:      sso@example.com / password');
    }
}
