import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { BaseCommand } from '../base-command.js';
import { localFilesAccessKey, localFilesSecretKey, maildevPassword, maildevUsername, successSymbol } from '../config/shared-service-config.js';
import { listActiveRouteManifests, RouteManifestKind } from '../runtime/manifest-store.js';
import type { RouteManifest } from '../runtime/manifest-store.js';
import { printSharedServicesStatus } from '../services/shared-services.js';
import { link, statusCell, table } from '../runtime/ux.js';
import { CliStatus } from '../runtime/status.js';
import { inspectDns, type DnsInspection } from '../workflows/dns-inspection.js';
import { inspectCaddy, type CaddyInspection, type CaddyLiveState } from '../workflows/caddy-inspection.js';

export default class Status extends BaseCommand {
    static summary = 'Show local development status';
    static description = 'Use this for a quick overview of what is already running, which instances are active, and which URLs and logins are available.';
    static examples = [
        'stam status',
        'stam status --current',
        'stam status --export',
        'stam status --verbose',
        'stam status --watch',
    ];

    static flags = { ...BaseCommand.verboseFlags, current: Flags.boolean({ default: false, description: 'Only show the inferred current instance' }), export: Flags.boolean({ default: false, description: 'Print full status inspection JSON and exit' }), watch: Flags.boolean({ default: false, description: 'Refresh the status view until interrupted' }) };

    async run(): Promise<void> {
        const { flags } = await this.parse(Status);
        const context = await this.createContext({ verbose: flags.verbose });
        if (flags.export) {
            const [dns, caddy, routes] = await Promise.all([inspectDns(context), inspectCaddy(context), listActiveRouteManifests(context)]);
            const instances = devInstanceManifests(routes);
            this.log(JSON.stringify({ dns, caddy, instances }, null, 4));
            return;
        }
        if (flags.watch) {
            while (true) {
                process.stdout.write('\x1Bc');
                await this.printStatus(context, flags.current, flags.verbose);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        await this.printStatus(context, flags.current, flags.verbose);
    }

    /** Prints shared services, DNS, Caddy, and active route manifests as one local development health overview. */
    private async printStatus(context: Awaited<ReturnType<Status['createContext']>>, current: boolean, verbose: boolean): Promise<void> {
        await printSharedServicesStatus(context);
        const [dns, caddy] = await Promise.all([inspectDns(context), inspectCaddy(context)]);
        this.printDns(dns, verbose);
        this.printCaddy(caddy);
        const instances = devInstanceManifests(await listActiveRouteManifests(context));
        const visible = current ? instances.filter(instance => instance.name === context.instance.name) : instances;
        this.log('\nActive instances:');
        if (visible.length === 0) {
            this.log('  none');
            this.printCredentials();
            return;
        }
        for (const instance of visible) {
            this.log(`  ${successSymbol} ${instance.name}`);
            this.log(`    Workspace: ${instance.workspace}`);
            const dashboard = routeHost(instance, host => host.startsWith('dashboard.'));
            const api = routeHost(instance, host => host.startsWith('api.'));
            if (dashboard) {
                this.log(`    Dashboard: ${link(`https://${dashboard}`, `https://${dashboard}`)}`);
            }
            if (api) {
                this.log(`    API:       ${link(`https://${api}`, `https://${api}`)}`);
            }
        }
        this.printCredentials();
    }

    private printDns(inspection: DnsInspection, verbose: boolean): void {
        table(['Zone', 'Type', 'Value', 'Applies to'], inspection.expected.records.map(record => [record.zone, record.type, record.value, record.appliesTo]), { title: `DNS records served by CoreDNS for .${inspection.domain}` });
        table(['Check', 'Status', 'Details'], inspection.checks.map(check => [check.label, statusCell(check.ok ? CliStatus.Ready : CliStatus.Missing), check.details]), { title: 'DNS checks' });
        if (verbose) {
            this.log('\nGenerated CoreDNS Corefile:');
            for (const line of inspection.expected.corefile.trimEnd().split('\n')) {
                this.log(`  ${line}`);
            }
        }
        const fixes = [...new Set(inspection.checks.map(check => check.fix).filter((fix): fix is string => fix !== undefined))];
        if (fixes.length > 0) {
            this.log('\nDNS next steps:');
            for (const fix of fixes) {
                this.log(`  Run: ${fix}`);
            }
        }
    }

    private printCaddy(inspection: CaddyInspection): void {
        const rows: string[][] = [];
        for (const group of inspection.routeGroups) {
            if (rows.length > 0) {
                rows.push(['', '', '']);
            }
            rows.push([chalk.bold(group.label), '', '']);
            const routes = [...group.routes].sort((a, b) => a.hosts[0].localeCompare(b.hosts[0]));
            rows.push(...routes.map(route => [route.hosts.join(', '), route.upstream, liveLabel(route.live)]));
        }
        table(['Host', 'Upstream', 'Live Caddy'], rows, { title: 'Caddy routes' });
    }

    private printCredentials(): void {
        this.log('\nCredentials:');
        this.log(`  MailDev:  ${maildevUsername} / ${maildevPassword}`);
        this.log(`  Files UI: ${localFilesAccessKey} / ${localFilesSecretKey}`);
        this.log('  SSO:      sso@example.com / password');
    }
}

function devInstanceManifests(manifests: RouteManifest[]): RouteManifest[] {
    return manifests.filter(manifest => manifest.kind === RouteManifestKind.DevInstance);
}

function routeHost(manifest: RouteManifest, predicate: (host: string) => boolean): string | undefined {
    return manifest.routes.flatMap(route => route.hosts).find(host => !host.startsWith('*.') && predicate(host));
}

function liveLabel(state: CaddyLiveState): string {
    switch (state) {
        case 'configured':
            return statusCell(CliStatus.Configured);
        case 'missing':
            return statusCell(CliStatus.Missing);
        case 'unavailable':
            return statusCell(CliStatus.Unavailable);
    }
}
