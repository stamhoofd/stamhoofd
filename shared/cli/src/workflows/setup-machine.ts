import fs from 'node:fs/promises';
import dns from 'node:dns/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import { writeSetupCaddyConfig } from '../config/caddy-config.js';
import { caddyContainer, caddyDataDir, caddyHttpPort, caddyHttpsPort, caddyRootCaPath, caddySetupAdminPort, defaultDomain, localIpv4Host, localhostPort } from '../config/shared-service-config.js';
import { buildSharedServiceProfile, SharedServiceDnsSetupKind } from '../config/shared-service-profile.js';
import type { SharedServiceProfile } from '../config/shared-service-profile.js';
import type { CliContext } from '../context/create-context.js';
import { run, RunVerbosity } from '../runtime/command-runner.js';
import { sharedDir } from '../runtime/manifest-store.js';
import { CliStatus } from '../runtime/status.js';
import { command, confirm, statusCell, success, table, Table, warning } from '../runtime/ux.js';
import type { TableCellInput, TableRow } from '../runtime/ux.js';
import { corednsService } from '../services/definitions/coredns-service.js';
import * as docker from '../services/docker.js';
import { runServices } from './start-services.js';
import { checkNodeVersion, setupNodeVersion } from './setup-node.js';
import { checkPackageManager, setupPackageManager } from './setup-package-manager.js';
import { checkVcs, setupVcs } from './setup-vcs.js';
import { checkShellShortcut } from './setup-shell.js';

const directDnsQueryTimeoutMs = 1000;

export type SetupReport = {
    node: CheckResult;
    pnpm: CheckResult;
    vcs: CheckResult;
    docker: CheckResult;
    privilegedPorts: CheckResult;
    caddy: CheckResult;
    dns: CheckResult;
    cert: CheckResult;
    shell: CheckResult;
};

export enum SetupAutomaticFixKey {
    Node = 'node',
    Pnpm = 'pnpm',
    Vcs = 'vcs',
    Dns = 'dns',
    PrivilegedPorts = 'privileged-ports',
    Services = 'services',
    Caddy = 'caddy',
    Cert = 'cert',
}

export type AutomaticFix = {
    key: SetupAutomaticFixKey;
    label: string;
};

export type CheckResult = {
    ok: boolean;
    optional?: boolean;
    details: string;
    manualFix?: string;
    automaticFix?: AutomaticFix;
};

function setupCheckDefinitions(context: CliContext): { key: keyof SetupReport; label: string; optional?: boolean; check: () => Promise<CheckResult> }[] {
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
    const profile = currentSharedServiceProfile(context.verbosity);
    return [
        { key: 'node', label: 'Node.js', check: () => nodeCheck(context) },
        { key: 'pnpm', label: 'pnpm', check: () => packageManagerCheck(context) },
        { key: 'vcs', label: 'Git / JJ', optional: true, check: () => vcsCheck(context) },
        { key: 'docker', label: 'Podman / Docker', check: () => dockerCheck(context.verbosity) },
        { key: 'privilegedPorts', label: 'Privileged port redirects', check: async () => privilegedPortRedirectCheck(await profile, context.verbosity) },
        { key: 'caddy', label: 'Caddy', check: () => caddyCheck(context.verbosity) },
        { key: 'dns', label: `DNS .${domain}`, check: async () => dnsCheck(context, await profile) },
        { key: 'cert', label: 'Caddy local CA', check: () => certCheck(context.verbosity) },
        { key: 'shell', label: 'Binary shortcut', optional: true, check: async () => {
            const result = await checkShellShortcut();
            return { ...result, ...(!result.ok ? { manualFix: 'pnpm stam setup shortcut' } : {}) };
        } },
    ];
}

export async function checkSetup(context: CliContext): Promise<SetupReport> {
    const results = await Promise.all(setupCheckDefinitions(context).map(async ({ key, optional, check }) => [key, { ...await check(), optional }]));
    return Object.fromEntries(results) as SetupReport;
}

export async function checkSetupWithTable(context: CliContext, options: { live: boolean }): Promise<SetupReport> {
    const checks = setupCheckDefinitions(context).map(definition => ({
        ...definition,
        row: Table.row([definition.label, Table.cell('checking', { indeterminate: true }), '']),
    }));
    const optional = checks.filter(check => check.optional);
    const liveTable = Table.create({
        title: 'Checking Stamhoofd local development setup',
        headers: ['Check', 'Status', 'Details'],
        rows: [
            ...checks.filter(check => !check.optional).map(check => check.row),
            ...(optional.length ? optionalSectionRows().map(cells => Table.row(cells)) : []),
            ...optional.map(check => check.row),
        ],
        live: options.live,
    });

    const results = await Promise.allSettled(checks.map(async ({ key, label, optional, check, row }) => [
        key,
        { ...await runSetupCheck(row, label, check()), optional },
    ]));

    await liveTable.wait();

    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (rejected) {
        throw rejected.reason;
    }

    return Object.fromEntries(results.map(result => result.status === 'fulfilled' ? result.value : neverRejected(result))) as SetupReport;
}

export function printSetupReport(report: SetupReport): void {
    const checks: [string, CheckResult][] = [
        ['Node.js', report.node],
        ['pnpm', report.pnpm],
        ['Git / JJ', report.vcs],
        ['Podman / Docker', report.docker],
        ['Privileged port redirects', report.privilegedPorts],
        ['Caddy', report.caddy],
        [`DNS .${process.env.STAMHOOFD_DOMAIN ?? defaultDomain}`, report.dns],
        ['Caddy local CA', report.cert],
        ['Binary shortcut', report.shell],
    ];
    const optional = checks.filter(([, result]) => result.optional);
    table(['Check', 'Status', 'Details'], [
        ...checks.filter(([, result]) => !result.optional).map(([label, result]) => row(label, result)),
        ...(optional.length ? optionalSectionRows() : []),
        ...optional.map(([label, result]) => row(label, result)),
    ], { title: 'Checking Stamhoofd local development setup' });
}

export async function runSetup(context: CliContext): Promise<void> {
    const attemptedFixes = new Set<SetupAutomaticFixKey>();
    while (true) {
        const report = await checkSetupWithTable(context, { live: true });
        const fixes = getRecommendedSetupFixes(report);
        if (fixes.length === 0) {
            if (!isSetupReady(report)) {
                console.log('\nResolve the missing manual setup items above, then run stam setup again.');
                return;
            }
            console.log('\nSetup looks ready. Next: stam dev all');
            return;
        }

        if (fixes.some(fix => attemptedFixes.has(fix.key))) {
            console.log('\nA recommended fix did not resolve its setup check. Review the missing items above, then run stam setup again.');
            return;
        }
        console.log('\nRecommended fixes:');
        fixes.forEach(({ label }, index) => console.log(`  ${index + 1}. ${label}`));
        console.log('');
        if (!(await confirm('Run recommended fixes now?', { default: true }))) {
            return;
        }
        for (const fix of fixes) {
            if (fix.key === SetupAutomaticFixKey.Node) {
                await setupNodeVersion(context.rootDir);
                console.log('\nActivate the new version in this terminal, then run stam setup again.');
                return;
            } else if (fix.key === SetupAutomaticFixKey.Pnpm) {
                await setupPackageManager(context.rootDir);
            } else if (fix.key === SetupAutomaticFixKey.Vcs) {
                await setupVcs(context.rootDir, { yes: true, dryRun: false, verbosity: context.verbosity });
            } else if (fix.key === SetupAutomaticFixKey.Dns) {
                await setupDns({ yes: true, dryRun: false });
            } else if (fix.key === SetupAutomaticFixKey.PrivilegedPorts) {
                await setupPrivilegedPortRedirects({ yes: true, dryRun: false });
            } else if (fix.key === SetupAutomaticFixKey.Services) {
                await runServices(context);
            } else if (fix.key === SetupAutomaticFixKey.Caddy) {
                await setupCaddy({ yes: true, dryRun: false });
            } else {
                await setupCert(context, { yes: true, dryRun: false });
            }
            attemptedFixes.add(fix.key);
        }
    }
}

export function getRecommendedSetupFixes(report: SetupReport): AutomaticFix[] {
    const fixes: AutomaticFix[] = [];

    for (const check of setupChecks(report)) {
        if (check.ok || check.optional) {
            continue;
        }
        if (!check.automaticFix) {
            break;
        }
        fixes.push(check.automaticFix);
        if (check.automaticFix.key === SetupAutomaticFixKey.Node) {
            break;
        }
    }

    return fixes;
}

export function isSetupReady(report: SetupReport): boolean {
    return setupChecks(report).every(check => check.ok || check.optional);
}

function setupChecks(report: SetupReport): CheckResult[] {
    return [report.node, report.pnpm, report.vcs, report.docker, report.privilegedPorts, report.caddy, report.dns, report.cert, report.shell];
}

function optionalSectionRows(): string[][] {
    return [['', '', ''], [chalk.dim('Optional'), '', '']];
}

async function vcsCheck(context: CliContext): Promise<CheckResult> {
    const missing = (await checkVcs(context.rootDir, context.verbosity)).filter(check => !check.ok);
    if (missing.length === 0) {
        return { ok: true, details: 'Repository push destinations configured' };
    }
    return {
        ok: false,
        details: missing.map(check => check.label).join(', '),
        manualFix: 'stam setup vcs',
        ...(missing.every(check => check.repairs.length > 0) ? { automaticFix: { key: SetupAutomaticFixKey.Vcs, label: 'Configure Git / JJ push destinations' } } : {}),
    };
}

async function nodeCheck(context: CliContext): Promise<CheckResult> {
    const check = await checkNodeVersion(context.rootDir);
    if (check.ok) {
        return { ok: true, details: check.details };
    }

    return {
        ok: false,
        details: check.details,
        manualFix: 'stam setup node',
        automaticFix: {
            key: SetupAutomaticFixKey.Node,
            label: `Install Node.js ${check.expected}`,
        },
    };
}

async function packageManagerCheck(context: CliContext): Promise<CheckResult> {
    const check = await checkPackageManager(context.rootDir, context.verbosity);
    if (check.ok) {
        return { ok: true, details: check.details };
    }

    return {
        ok: false,
        details: check.details,
        manualFix: 'stam setup pnpm',
        automaticFix: {
            key: SetupAutomaticFixKey.Pnpm,
            label: `Install pnpm ${check.expected} with Corepack`,
        },
    };
}

enum IptablesChain {
    Prerouting = 'PREROUTING',
    Output = 'OUTPUT',
}

enum IptablesAction {
    Append = '-A',
    Check = '-C',
}

type IptablesRedirectRule = {
    chain: IptablesChain;
    fromPort: number;
    toPort: number;
    destination?: string;
};

function privilegedRedirectRules(profile: SharedServiceProfile): IptablesRedirectRule[] {
    return [
        { chain: IptablesChain.Prerouting, fromPort: caddyHttpPort, toPort: profile.caddyHttpHostPort },
        { chain: IptablesChain.Prerouting, fromPort: caddyHttpsPort, toPort: profile.caddyHttpsHostPort },
        { chain: IptablesChain.Output, destination: localIpv4Host, fromPort: caddyHttpPort, toPort: profile.caddyHttpHostPort },
        { chain: IptablesChain.Output, destination: localIpv4Host, fromPort: caddyHttpsPort, toPort: profile.caddyHttpsHostPort },
    ];
}

export async function setupDns(options: { yes: boolean; dryRun: boolean }): Promise<void> {
    const profile = await currentSharedServiceProfile();
    if (profile.dnsSetupKind === SharedServiceDnsSetupKind.MacosResolver) {
        await setupMacosDns(options);
        return;
    }
    if (profile.dnsSetupKind !== SharedServiceDnsSetupKind.SystemdResolved) {
        throw new Error('Automatic DNS setup is not supported on this platform.');
    }
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
    const content = `[Resolve]\nDNS=${localIpv4Host}:${profile.corednsHostPort}\nDomains=~${domain}\n`;
    const tempPath = path.join(os.tmpdir(), `stamhoofd-resolved-${process.pid}.conf`);

    console.log(`This will configure temporary split DNS for .${domain}.`);
    console.log('\nFile: /run/systemd/resolved.conf.d/stamhoofd.conf');
    console.log(content.trim());
    console.log('\nCommands:');
    console.log(command('  sudo mkdir -p /run/systemd/resolved.conf.d'));
    console.log(command('  sudo cp <tempfile> /run/systemd/resolved.conf.d/stamhoofd.conf'));
    console.log(command('  sudo systemctl restart systemd-resolved'));

    if (options.dryRun) {
        warning('Dry run: DNS configuration was not changed.');
        return;
    }
    if (!options.yes && !(await confirm('Apply this DNS configuration?', { default: true }))) {
        warning('DNS setup skipped.');
        return;
    }

    await fs.writeFile(tempPath, content);
    await run('sudo', ['mkdir', '-p', '/run/systemd/resolved.conf.d'], { verbosity: RunVerbosity.Output });
    await run('sudo', ['cp', tempPath, '/run/systemd/resolved.conf.d/stamhoofd.conf'], { verbosity: RunVerbosity.Output });
    await fs.rm(tempPath, { force: true });
    await run('sudo', ['systemctl', 'restart', 'systemd-resolved'], { verbosity: RunVerbosity.Output });
    success('DNS configured.');
}

async function setupMacosDns(options: { yes: boolean; dryRun: boolean }): Promise<void> {
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
    const resolverPath = macosResolverPath(domain);
    const content = macosResolverContent();
    const tempPath = path.join(os.tmpdir(), `stamhoofd-resolver-${process.pid}.conf`);
    const existing = await readFileIfExists(resolverPath);

    console.log(`This will configure .${domain} DNS through the macOS resolver.`);
    console.log(`\nFile: ${resolverPath}`);
    console.log(content.trim());
    console.log('\nCommands:');
    console.log(command('  sudo mkdir -p /etc/resolver'));
    console.log(command(`  sudo cp <tempfile> ${resolverPath}`));

    if (existing !== undefined && existing !== content) {
        warning(`${resolverPath} already exists with different contents.`);
    }
    if (existing === content) {
        success('DNS already configured.');
        return;
    }

    if (options.dryRun) {
        warning('Dry run: DNS configuration was not changed.');
        return;
    }
    if (existing !== undefined && existing !== content && !options.yes && !(await confirm(`Overwrite ${resolverPath}?`, { default: false }))) {
        warning('DNS setup skipped.');
        return;
    }
    if (existing === undefined && !options.yes && !(await confirm('Apply this DNS configuration?', { default: true }))) {
        warning('DNS setup skipped.');
        return;
    }

    await fs.writeFile(tempPath, content);
    await run('sudo', ['mkdir', '-p', '/etc/resolver'], { verbosity: RunVerbosity.Output });
    await run('sudo', ['cp', tempPath, resolverPath], { verbosity: RunVerbosity.Output });
    await fs.rm(tempPath, { force: true });
    success('DNS configured.');
}

export async function setupPrivilegedPortRedirects(options: { yes: boolean; dryRun: boolean }): Promise<void> {
    if (process.platform !== 'linux') {
        throw new Error('Automatic privileged port redirect setup currently supports Linux with iptables only.');
    }
    const profile = await currentSharedServiceProfile();
    const rules = privilegedRedirectRules(profile);

    console.log('This will redirect local HTTP/HTTPS traffic to the unprivileged ports used by local containers.');
    console.log('\nCommands:');
    for (const rule of rules) {
        console.log(command(`  ${formatIptablesCommand(IptablesAction.Append, rule)}`));
    }

    if (options.dryRun) {
        warning('Dry run: privileged port redirects were not changed.');
        return;
    }
    if (!options.yes && !(await confirm('Apply these privileged port redirects?', { default: true }))) {
        warning('Privileged port redirect setup skipped.');
        return;
    }

    for (const rule of rules) {
        if (!(await iptablesRuleExists(rule))) {
            await run('sudo', iptablesArgs(IptablesAction.Append, rule), { verbosity: RunVerbosity.Output });
        }
    }

    success('Privileged port redirects configured.');
}

export async function setupCaddy(options: { yes: boolean; dryRun: boolean }): Promise<void> {
    if (process.platform !== 'darwin') {
        throw new Error('Automatic Caddy installation currently supports macOS with Homebrew only.');
    }
    console.log('This will install Caddy using Homebrew.');
    console.log('\nCommands:');
    console.log(command('  brew install caddy'));
    if (options.dryRun) {
        warning('Dry run: Caddy was not installed.');
        return;
    }
    if (!options.yes && !(await confirm('Install Caddy with Homebrew?', { default: true }))) {
        warning('Caddy installation skipped.');
        return;
    }
    await run('brew', ['install', 'caddy'], { verbosity: RunVerbosity.Output });
    success('Caddy installed.');
}

export async function setupCert(context: CliContext, options: { yes: boolean; dryRun: boolean }): Promise<void> {
    console.log('This will trust the local development CA using a temporary local Caddy instance.');
    if (options.dryRun) {
        warning('Dry run: certificate trust was not changed.');
        return;
    }
    if (!options.yes && !(await confirm('Trust the Stamhoofd development CA?', { default: true }))) {
        warning('Certificate setup skipped.');
        return;
    }
    await fs.mkdir(sharedDir(context), { recursive: true });
    const configPath = await writeSetupCaddyConfig(context);
    const pidPath = path.join(sharedDir(context), 'caddy-setup.pid');
    console.log('Preparing temporary local Caddy CA...');
    await run('caddy', ['start', '--config', configPath, '--pidfile', pidPath], { verbosity: RunVerbosity.Output });
    try {
        await run('caddy', ['trust', '--config', configPath, '--address', localhostPort(caddySetupAdminPort)], { verbosity: RunVerbosity.Output });
    } finally {
        await run('caddy', ['stop', '--config', configPath, '--address', localhostPort(caddySetupAdminPort)], { allowFailure: true, verbosity: context.verbosity === RunVerbosity.Output ? RunVerbosity.Command : context.verbosity ?? RunVerbosity.Quiet });
        await fs.rm(pidPath, { force: true });
    }
    success('Caddy local CA trusted.');
}

async function dnsCheck(context: CliContext, profile: SharedServiceProfile): Promise<CheckResult> {
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;

    if (profile.dnsSetupKind === SharedServiceDnsSetupKind.MacosResolver) {
        return await macosDnsCheck(context, domain);
    }

    if (!(await dnsConfigurationCheck(domain, profile, context.verbosity))) {
        return { ok: false, details: `Local DNS is not configured for .${domain}`, manualFix: 'stam setup dns', automaticFix: { key: SetupAutomaticFixKey.Dns, label: 'Configure local DNS' } };
    }

    const result = await run('resolvectl', ['query', `dashboard.${domain}`], { capture: true, allowFailure: true, verbosity: context.verbosity ?? RunVerbosity.Quiet });
    if (result.stdout.includes(localIpv4Host)) {
        return { ok: true, details: `dashboard.${domain} resolves to ${localIpv4Host}` };
    }

    const corednsStatus = await corednsService.status(context);
    if (!corednsStatus.running) {
        return { ok: false, details: `Local DNS is configured, but CoreDNS is not running`, manualFix: 'stam services up', automaticFix: { key: SetupAutomaticFixKey.Services, label: 'Start shared services' } };
    }

    return { ok: false, details: `Local DNS is configured and CoreDNS is running, but dashboard.${domain} does not resolve to ${localIpv4Host}`, manualFix: 'stam setup dns' };
}

async function macosDnsCheck(context: CliContext, domain: string): Promise<CheckResult> {
    const resolverPath = macosResolverPath(domain);
    const content = await readFileIfExists(resolverPath);
    if (content === undefined) {
        return { ok: false, details: `${resolverPath} does not exist`, manualFix: 'stam setup dns', automaticFix: { key: SetupAutomaticFixKey.Dns, label: 'Configure local DNS' } };
    }
    if (content !== macosResolverContent()) {
        return { ok: false, details: `${resolverPath} exists with unexpected contents`, manualFix: 'stam setup dns' };
    }

    const corednsStatus = await corednsService.status(context);
    if (!corednsStatus.running) {
        return { ok: false, details: `Local DNS is configured, but CoreDNS is not running`, manualFix: 'stam services up', automaticFix: { key: SetupAutomaticFixKey.Services, label: 'Start shared services' } };
    }

    if (await directCorednsCheck(domain)) {
        return { ok: true, details: `dashboard.${domain} resolves to ${localIpv4Host}` };
    }

    return { ok: false, details: `Local DNS is configured and CoreDNS is running, but dashboard.${domain} does not resolve to ${process.env.PUBLIC_IP || localIpv4Host}`, manualFix: 'stam setup dns' };
}

async function directCorednsCheck(domain: string): Promise<boolean> {
    const resolver = new dns.Resolver({ timeout: directDnsQueryTimeoutMs, tries: 1 });
    resolver.setServers([localIpv4Host]);
    try {
        const addresses = await resolver.resolve4(`dashboard.${domain}`);
        return addresses.includes(process.env.PUBLIC_IP || localIpv4Host);
    } catch {
        return false;
    }
}

async function dnsConfigurationCheck(domain: string, profile: SharedServiceProfile, verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<boolean> {
    const [dns, domains] = await Promise.all([
        run('resolvectl', ['dns'], { capture: true, allowFailure: true, verbosity }),
        run('resolvectl', ['domain'], { capture: true, allowFailure: true, verbosity }),
    ]);

    return dns.status === 0
        && domains.status === 0
        && dns.stdout.includes(`${localIpv4Host}:${profile.corednsHostPort}`)
        && domains.stdout.includes(`~${domain}`);
}

async function certCheck(verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<CheckResult> {
    const certPath = caddyRootCaPath();
    try {
        await fs.access(certPath);
    } catch {
        return { ok: false, details: 'Caddy local CA not found', manualFix: 'stam setup cert', automaticFix: { key: SetupAutomaticFixKey.Cert, label: 'Trust local HTTPS certificates' } };
    }
    if (process.platform === 'darwin') {
        const result = await run('security', ['verify-cert', '-c', certPath, '-p', 'ssl', '-l', '-L', '-q'], { capture: true, allowFailure: true, verbosity });
        if (result.status !== 0) {
            return { ok: false, details: 'Caddy local CA is not trusted by macOS', manualFix: 'stam setup cert', automaticFix: { key: SetupAutomaticFixKey.Cert, label: 'Trust local HTTPS certificates' } };
        }
    }
    return { ok: true, details: certPath };
}

async function privilegedPortRedirectCheck(profile: SharedServiceProfile, verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<CheckResult> {
    if (!profile.needsPrivilegedRedirects) {
        return { ok: true, details: 'not needed for docker' };
    }

    if (process.platform !== 'linux') {
        return { ok: false, details: 'Privileged port redirects require Linux with iptables', manualFix: 'Configure privileged port redirects' };
    }

    let caddyRunning: boolean;
    try {
        caddyRunning = await docker.containerIsRunning(caddyContainer, verbosity);
    } catch {
        return { ok: true, details: 'container runtime unavailable' };
    }

    if (caddyRunning) {
        const highPortsReady = await portAcceptsConnection(profile.caddyHttpHostPort) && await portAcceptsConnection(profile.caddyHttpsHostPort);
        if (!highPortsReady) {
            return { ok: false, details: `Caddy is running, but ${localhostPort(profile.caddyHttpHostPort)} or ${localhostPort(profile.caddyHttpsHostPort)} is not reachable`, manualFix: 'stam services restart' };
        }

        if (await portAcceptsConnection(caddyHttpPort) && await portAcceptsConnection(caddyHttpsPort)) {
            return { ok: true, details: `${localhostPort(caddyHttpPort)} -> ${localhostPort(profile.caddyHttpHostPort)}, ${localhostPort(caddyHttpsPort)} -> ${localhostPort(profile.caddyHttpsHostPort)}` };
        }
    }

    const missingRules: IptablesRedirectRule[] = [];
    for (const rule of privilegedRedirectRules(profile)) {
        if (!(await iptablesRuleExists(rule, verbosity))) {
            missingRules.push(rule);
        }
    }

    return missingRules.length === 0
        ? { ok: true, details: `${localhostPort(caddyHttpPort)} -> ${localhostPort(profile.caddyHttpHostPort)}, ${localhostPort(caddyHttpsPort)} -> ${localhostPort(profile.caddyHttpsHostPort)}` }
        : { ok: false, details: `${missingRules.length} privileged port redirect${missingRules.length === 1 ? '' : 's'} missing`, manualFix: 'stam setup', automaticFix: { key: SetupAutomaticFixKey.PrivilegedPorts, label: 'Configure privileged port redirects' } };
}

async function caddyCheck(verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<CheckResult> {
    const result = await run('caddy', ['version'], { capture: true, allowFailure: true, verbosity });
    if (result.status !== 0) {
        if (process.platform === 'darwin') {
            return { ok: false, details: 'caddy not found', manualFix: 'stam setup', automaticFix: { key: SetupAutomaticFixKey.Caddy, label: 'Install Caddy with Homebrew' } };
        }
        return { ok: false, details: 'caddy not found', manualFix: 'Install Caddy, then run stam setup cert' };
    }
    return { ok: true, details: result.stdout.trim() };
}

async function currentSharedServiceProfile(verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<SharedServiceProfile> {
    let runtime = docker.ContainerRuntime.Docker;
    try {
        runtime = await docker.getContainerRuntime(verbosity);
    } catch {
        // Setup can still report DNS and Caddy issues before Docker is running.
    }
    return buildSharedServiceProfile(runtime);
}

function macosResolverPath(domain: string): string {
    return path.join('/etc/resolver', domain);
}

function macosResolverContent(): string {
    return `nameserver ${localIpv4Host}\n`;
}

async function readFileIfExists(filePath: string): Promise<string | undefined> {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

async function iptablesRuleExists(rule: IptablesRedirectRule, verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<boolean> {
    const result = await run('sudo', ['-n', ...iptablesArgs(IptablesAction.Check, rule)], { capture: true, verbosity, allowFailure: true });
    return result.status === 0;
}

async function portAcceptsConnection(port: number): Promise<boolean> {
    return await new Promise((resolve) => {
        const socket = net.createConnection({ host: localIpv4Host, port });
        const done = (result: boolean) => {
            socket.destroy();
            resolve(result);
        };
        socket.setTimeout(500);
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
        socket.once('timeout', () => done(false));
    });
}

function iptablesArgs(action: IptablesAction, rule: IptablesRedirectRule): string[] {
    return [
        'iptables',
        '-t',
        'nat',
        action,
        rule.chain,
        '-p',
        'tcp',
        ...(rule.destination ? ['-d', rule.destination] : []),
        '--dport',
        String(rule.fromPort),
        '-j',
        'REDIRECT',
        '--to-port',
        String(rule.toPort),
    ];
}

function formatIptablesCommand(action: IptablesAction, rule: IptablesRedirectRule): string {
    return ['sudo', ...iptablesArgs(action, rule)].join(' ');
}

async function dockerCheck(verbosity: RunVerbosity = RunVerbosity.Quiet): Promise<CheckResult> {
    try {
        const runtime = await docker.getContainerRuntime(verbosity);
        return { ok: true, details: runtime === docker.ContainerRuntime.Podman ? 'podman ready' : 'docker daemon reachable' };
    } catch (error) {
        return { ok: false, details: error instanceof Error ? error.message : 'container runtime not reachable', manualFix: 'Start Podman or Docker, then run stam setup' };
    }
}

async function runSetupCheck(row: TableRow, label: string, check: Promise<CheckResult>): Promise<CheckResult> {
    try {
        const result = await check;
        row.update(setupRow(label, result));
        return result;
    } catch (error) {
        row.update([
            label,
            statusCell(CliStatus.Failed),
            error instanceof Error ? error.message : String(error),
        ]);
        throw error;
    }
}

function neverRejected(result: PromiseRejectedResult): never {
    throw result.reason;
}

function row(label: string, result: CheckResult): string[] {
    return setupRow(label, result) as string[];
}

function setupRow(label: string, result: CheckResult): TableCellInput[] {
    return [label, statusCell(result.ok ? CliStatus.Ready : CliStatus.Missing), result.manualFix ? `${result.details} (${result.manualFix})` : result.details];
}
