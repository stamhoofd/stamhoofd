import { Args } from '@oclif/core';
import { BaseCommand } from '../../base-command.js';
import { dryRunFlag, yesFlag } from '../../command-flags.js';
import { buildBackendEnv } from '../../config/build-config.js';
import { localIpv4Host, mysqlContainer, mysqlRootPassword, mysqlRootUser } from '../../config/shared-service-config.js';
import { cleanBuild } from '../../runtime/monorepo-runner.js';
import { showHelp } from '../../runtime/show-help.js';
import { confirm, warning } from '../../runtime/ux.js';
import { ssoService } from '../../services/definitions/sso-service.js';
import * as docker from '../../services/docker.js';
import { deleteSharedServicesData, stopSharedServices } from '../../services/shared-services.js';

enum CleanTarget {
    All = 'all',
    Build = 'build',
    Db = 'db',
    Services = 'services',
    Sso = 'sso',
}

const cleanTargets = [CleanTarget.All, CleanTarget.Build, CleanTarget.Db, CleanTarget.Services, CleanTarget.Sso] as const;

export default class Clean extends BaseCommand {
    static summary = 'Remove local generated state';
    static description = 'Use this when stale local data is causing confusing errors and you need to remove build output, local databases, service data, or local SSO state.';
    static examples = [
        'stam clean build --dry-run',
        'stam clean services --yes',
        'stam clean all --env keeo --yes',
    ];

    static args = {
        target: Args.string({
            description: 'Cleanup target',
            options: [...cleanTargets],
            required: false,
        }),
    };

    static flags = { ...BaseCommand.instanceFlags, yes: yesFlag, 'dry-run': dryRunFlag };

    async run(): Promise<void> {
        const { args, flags } = await this.parse(Clean);
        if (!args.target) {
            await showHelp(this.config, ['clean']);
            return;
        }

        const target = args.target as CleanTarget;

        this.validateTargetFlags(target, flags);

        const context = await this.createContext(flags);

        if (target === CleanTarget.Build) {
            await cleanBuild(context, { dryRun: flags['dry-run'] });
            return;
        }

        if (target === CleanTarget.Db) {
            await this.cleanDatabase(context, { yes: flags.yes, dryRun: flags['dry-run'] });
            return;
        }

        if (target === CleanTarget.Services) {
            await this.cleanServices(context, { yes: flags.yes, dryRun: flags['dry-run'] });
            return;
        }

        if (target === CleanTarget.Sso) {
            await this.cleanSso(context, { dryRun: flags['dry-run'] });
            return;
        }

        await this.cleanAll(context, { yes: flags.yes, dryRun: flags['dry-run'] });
    }

    private async cleanAll(context: Awaited<ReturnType<Clean['createContext']>>, options: { yes: boolean; dryRun: boolean }): Promise<void> {
        if (options.dryRun) {
            await cleanBuild(context, { dryRun: true });
            console.log(`Would drop local MySQL database ${buildBackendEnv(context).DB_DATABASE ?? 'stamhoofd-development'}.`);
            console.log('Would stop local SSO server.');
            console.log('Would stop shared services and delete MySQL, RustFS, and Caddy data.');
            return;
        }

        if (!options.yes && !(await confirm('Clean build artifacts, drop the local database, stop local SSO, and delete shared service data?'))) {
            warning('Clean skipped.');
            return;
        }

        await cleanBuild(context);
        await this.dropDatabase(context);
        await ssoService.stop(context);
        await stopSharedServices(context);
        await deleteSharedServicesData(context);
    }

    private async cleanDatabase(context: Awaited<ReturnType<Clean['createContext']>>, options: { yes: boolean; dryRun: boolean }): Promise<void> {
        const database = buildBackendEnv(context).DB_DATABASE ?? 'stamhoofd-development';

        if (options.dryRun) {
            console.log(`Would drop local MySQL database ${database}.`);
            return;
        }

        if (!options.yes && !(await confirm(`Drop local MySQL database ${database}?`))) {
            warning('Clean skipped.');
            return;
        }

        await this.dropDatabase(context);
    }

    private async cleanServices(context: Awaited<ReturnType<Clean['createContext']>>, options: { yes: boolean; dryRun: boolean }): Promise<void> {
        if (options.dryRun) {
            console.log('Would stop shared services.');
            console.log('Would delete MySQL, RustFS, and Caddy shared service data.');
            return;
        }

        if (!options.yes && !(await confirm('Stop shared services and delete MySQL, RustFS, and Caddy data?'))) {
            warning('Clean skipped.');
            return;
        }

        await stopSharedServices(context);
        await deleteSharedServicesData(context);
    }

    private async cleanSso(context: Awaited<ReturnType<Clean['createContext']>>, options: { dryRun: boolean }): Promise<void> {
        if (options.dryRun) {
            console.log('Would stop local SSO server.');
            return;
        }

        await ssoService.stop(context);
        this.log('Local SSO server stopped.');
    }

    private async dropDatabase(context: Awaited<ReturnType<Clean['createContext']>>): Promise<void> {
        const database = buildBackendEnv(context).DB_DATABASE ?? 'stamhoofd-development';
        await docker.run(['exec', mysqlContainer, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-e', `DROP DATABASE IF EXISTS \`${database.replaceAll('`', '``')}\`;`]);
    }

    private validateTargetFlags(target: CleanTarget, flags: { env?: string; name?: string }): void {
        if (target === CleanTarget.Db || target === CleanTarget.All) {
            return;
        }

        if (flags.env && flags.env !== 'stamhoofd') {
            this.error(`--env only applies to 'clean ${CleanTarget.Db}' and 'clean ${CleanTarget.All}'.`);
        }

        if (flags.name) {
            this.error(`--name only applies to 'clean ${CleanTarget.Db}' and 'clean ${CleanTarget.All}'.`);
        }
    }
}
