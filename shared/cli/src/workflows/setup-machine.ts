import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { caddyContainer, caddyHttpPort, caddyHttpsPort, caddyPodmanHttpPort, caddyPodmanHttpsPort, caddySetupAdminPort, corednsHostPort, defaultDomain, localIpv4Host, localhostPort } from '../config/shared-service-config.js';
import { sharedDir } from '../runtime/manifest-store.js';
import { run } from '../runtime/command-runner.js';
import { writeSetupCaddyConfig } from '../config/caddy-config.js';
import { command, confirm, statusCell, success, table, warning } from '../runtime/ux.js';
import type { CliContext } from '../context/create-context.js';
import { caddySetupHttpPort, caddySetupHttpsPort } from '../config/shared-service-config.js';
import { corednsService } from '../services/definitions/coredns-service.js';
import * as docker from '../services/docker.js';
import { runServices } from './start-services.js';

export type SetupReport = {
    docker: CheckResult;
    podmanPorts: CheckResult;
    caddy: CheckResult;
    dns: CheckResult;
    cert: CheckResult;
};

export type AutomaticFix = {
    key: 'dns' | 'podman-ports' | 'services' | 'cert';
    label: string;
};

export type CheckResult = {
    ok: boolean;
    details: string;
    manualFix?: string;
    automaticFix?: AutomaticFix;
};

export async function checkSetup(context: CliContext): Promise<SetupReport> {
    return {
        docker: await dockerCheck(),
        podmanPorts: await podmanPortRedirectCheck(),
        caddy: await caddyCheck(),
        dns: await dnsCheck(context),
        cert: await certCheck(),
    };
}

export function printSetupReport(report: SetupReport): void {
    table(['Check', 'Status', 'Details'], [
        row('Podman / Docker', report.docker),
        row('Podman port redirects', report.podmanPorts),
        row('Caddy', report.caddy),
        row(`DNS .${process.env.STAMHOOFD_DOMAIN ?? defaultDomain}`, report.dns),
        row('Caddy local CA', report.cert),
    ], { title: 'Checking Stamhoofd local development setup' });
}

export async function runSetup(context: CliContext): Promise<void> {
    const report = await checkSetup(context);
    printSetupReport(report);
    const fixes = getRecommendedSetupFixes(report);
    if (fixes.length === 0) {
        if (setupChecks(report).some(check => !check.ok)) {
            console.log('\nResolve the missing manual setup items above, then run stam setup again.');
            return;
        }
        console.log('\nSetup looks ready. Next: stam dev all');
        return;
    }
    console.log('\nRecommended fixes:');
    fixes.forEach(({ label }, index) => console.log(`  ${index + 1}. ${label}`));
    console.log('');
    if (!(await confirm('Run recommended fixes now?', { default: true }))) {
        return;
    }
    for (const fix of fixes) {
        if (fix.key === 'dns') {
            await setupDns({ yes: true, dryRun: false, verbose: context.verbose });
        }
        else if (fix.key === 'podman-ports') {
            await setupPodmanPortRedirects({ yes: true, dryRun: false, verbose: context.verbose });
        }
        else if (fix.key === 'services') {
            await runServices(context);
        }
        else {
            await setupCert(context, { yes: true, dryRun: false });
        }
    }
}

export function getRecommendedSetupFixes(report: SetupReport): AutomaticFix[] {
    const fixes: AutomaticFix[] = [];

    for (const check of setupChecks(report)) {
        if (check.ok) {
            continue;
        }
        if (!check.automaticFix) {
            break;
        }
        fixes.push(check.automaticFix);
    }

    return fixes;
}

export function isSetupReady(report: SetupReport): boolean {
    return setupChecks(report).every(check => check.ok);
}

function setupChecks(report: SetupReport): CheckResult[] {
    return [report.docker, report.podmanPorts, report.caddy, report.dns, report.cert];
}

type IptablesRedirectRule = {
    chain: 'PREROUTING' | 'OUTPUT';
    fromPort: number;
    toPort: number;
    destination?: string;
};

const podmanRedirectRules: IptablesRedirectRule[] = [
    { chain: 'PREROUTING', fromPort: caddyHttpPort, toPort: caddyPodmanHttpPort },
    { chain: 'PREROUTING', fromPort: caddyHttpsPort, toPort: caddyPodmanHttpsPort },
    { chain: 'OUTPUT', destination: localIpv4Host, fromPort: caddyHttpPort, toPort: caddyPodmanHttpPort },
    { chain: 'OUTPUT', destination: localIpv4Host, fromPort: caddyHttpsPort, toPort: caddyPodmanHttpsPort },
];

export async function setupDns(options: { yes: boolean; dryRun: boolean; verbose: boolean }): Promise<void> {
    if (process.platform !== 'linux') {
        throw new Error('Automatic DNS setup currently supports Linux with systemd-resolved only.');
    }
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;
    const content = `[Resolve]\nDNS=${localIpv4Host}:${corednsHostPort}\nDomains=~${domain}\n`;
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
    await run('sudo', ['mkdir', '-p', '/run/systemd/resolved.conf.d'], { verbose: options.verbose });
    await run('sudo', ['cp', tempPath, '/run/systemd/resolved.conf.d/stamhoofd.conf'], { verbose: options.verbose });
    await fs.rm(tempPath, { force: true });
    await run('sudo', ['systemctl', 'restart', 'systemd-resolved'], { verbose: options.verbose });
    success('DNS configured.');
}

export async function setupPodmanPortRedirects(options: { yes: boolean; dryRun: boolean; verbose: boolean }): Promise<void> {
    if (process.platform !== 'linux') {
        throw new Error('Automatic Podman port redirect setup currently supports Linux with iptables only.');
    }

    console.log('This will redirect local HTTP/HTTPS traffic to the unprivileged ports used by rootless Podman.');
    console.log('\nCommands:');
    for (const rule of podmanRedirectRules) {
        console.log(command(`  ${formatIptablesCommand('-A', rule)}`));
    }

    if (options.dryRun) {
        warning('Dry run: Podman port redirects were not changed.');
        return;
    }
    if (!options.yes && !(await confirm('Apply these Podman port redirects?', { default: true }))) {
        warning('Podman port redirect setup skipped.');
        return;
    }

    for (const rule of podmanRedirectRules) {
        if (!(await iptablesRuleExists(rule))) {
            await run('sudo', iptablesArgs('-A', rule), { verbose: options.verbose });
        }
    }

    success('Podman port redirects configured.');
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
    await run('caddy', ['start', '--config', configPath, '--pidfile', pidPath], { verbose: context.verbose });
    try {
        await run('caddy', ['trust', '--config', configPath, '--address', localhostPort(caddySetupAdminPort)], { verbose: context.verbose });
    }
    finally {
        await run('caddy', ['stop', '--config', configPath, '--address', localhostPort(caddySetupAdminPort)], { allowFailure: true, quiet: true, verbose: context.verbose });
        await fs.rm(pidPath, { force: true });
    }
    success('Caddy local CA trusted.');
}

async function dnsCheck(context: CliContext): Promise<CheckResult> {
    const domain = process.env.STAMHOOFD_DOMAIN ?? defaultDomain;

    if (!(await dnsConfigurationCheck(domain))) {
        return { ok: false, details: `Local DNS is not configured for .${domain}`, manualFix: 'stam setup dns', automaticFix: { key: 'dns', label: 'Configure local DNS' } };
    }

    const result = await run('resolvectl', ['query', `dashboard.${domain}`], { capture: true, allowFailure: true });
    if (result.stdout.includes(localIpv4Host)) {
        return { ok: true, details: `dashboard.${domain} resolves to ${localIpv4Host}` };
    }

    const corednsStatus = await corednsService.status(context);
    if (!corednsStatus.running) {
        return { ok: false, details: `Local DNS is configured, but CoreDNS is not running`, manualFix: 'stam services up', automaticFix: { key: 'services', label: 'Start shared services' } };
    }

    return { ok: false, details: `Local DNS is configured and CoreDNS is running, but dashboard.${domain} does not resolve to ${localIpv4Host}`, manualFix: 'stam setup dns' };
}

async function dnsConfigurationCheck(domain: string): Promise<boolean> {
    const [dns, domains] = await Promise.all([
        run('resolvectl', ['dns'], { capture: true, allowFailure: true }),
        run('resolvectl', ['domain'], { capture: true, allowFailure: true }),
    ]);

    return dns.status === 0
        && domains.status === 0
        && dns.stdout.includes(`${localIpv4Host}:${corednsHostPort}`)
        && domains.stdout.includes(`~${domain}`);
}

async function certCheck(): Promise<CheckResult> {
    const home = process.env.XDG_DATA_HOME ?? `${process.env.HOME}/.local/share`;
    const certPath = path.join(home, 'caddy/pki/authorities/local/root.crt');
    try {
        await fs.access(certPath);
        return { ok: true, details: certPath };
    }
    catch {
        return { ok: false, details: 'Caddy local CA not found', manualFix: 'stam setup cert', automaticFix: { key: 'cert', label: 'Trust local HTTPS certificates' } };
    }
}

async function podmanPortRedirectCheck(): Promise<CheckResult> {
    let runtime: docker.ContainerRuntime;
    try {
        runtime = await docker.getContainerRuntime();
    }
    catch {
        return { ok: true, details: 'container runtime unavailable' };
    }

    if (runtime !== 'podman') {
        return { ok: true, details: 'not needed for docker' };
    }

    if (process.platform !== 'linux') {
        return { ok: false, details: 'Podman port redirects require Linux with iptables', manualFix: 'Configure privileged port redirects for Podman' };
    }

    if (await docker.containerIsRunning(caddyContainer)) {
        const podmanPortsReady = await portAcceptsConnection(caddyPodmanHttpPort) && await portAcceptsConnection(caddyPodmanHttpsPort);
        if (!podmanPortsReady) {
            return { ok: false, details: `Caddy is running, but ${localhostPort(caddyPodmanHttpPort)} or ${localhostPort(caddyPodmanHttpsPort)} is not reachable`, manualFix: 'stam services restart' };
        }

        if (await portAcceptsConnection(caddyHttpPort) && await portAcceptsConnection(caddyHttpsPort)) {
            return { ok: true, details: `${localhostPort(caddyHttpPort)} -> ${localhostPort(caddyPodmanHttpPort)}, ${localhostPort(caddyHttpsPort)} -> ${localhostPort(caddyPodmanHttpsPort)}` };
        }
    }

    const missingRules: IptablesRedirectRule[] = [];
    for (const rule of podmanRedirectRules) {
        if (!(await iptablesRuleExists(rule))) {
            missingRules.push(rule);
        }
    }

    return missingRules.length === 0
        ? { ok: true, details: `${localhostPort(caddyHttpPort)} -> ${localhostPort(caddyPodmanHttpPort)}, ${localhostPort(caddyHttpsPort)} -> ${localhostPort(caddyPodmanHttpsPort)}` }
        : { ok: false, details: `${missingRules.length} Podman port redirect${missingRules.length === 1 ? '' : 's'} missing`, manualFix: 'stam setup', automaticFix: { key: 'podman-ports', label: 'Configure Podman port redirects' } };
}

async function caddyCheck(): Promise<CheckResult> {
    const result = await run('caddy', ['version'], { capture: true, allowFailure: true });
    if (result.status !== 0) {
        return { ok: false, details: 'caddy not found', manualFix: 'Install Caddy, then run stam setup cert' };
    }
    return { ok: true, details: result.stdout.trim() };
}

async function iptablesRuleExists(rule: IptablesRedirectRule): Promise<boolean> {
    const result = await run('sudo', ['-n', ...iptablesArgs('-C', rule)], { capture: true, quiet: true, allowFailure: true });
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

function iptablesArgs(action: '-A' | '-C', rule: IptablesRedirectRule): string[] {
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

function formatIptablesCommand(action: '-A' | '-C', rule: IptablesRedirectRule): string {
    return ['sudo', ...iptablesArgs(action, rule)].join(' ');
}

async function dockerCheck(): Promise<CheckResult> {
    try {
        const runtime = await docker.getContainerRuntime();
        return { ok: true, details: runtime === 'podman' ? 'podman ready' : 'docker daemon reachable' };
    }
    catch (error) {
        return { ok: false, details: error instanceof Error ? error.message : 'container runtime not reachable', manualFix: 'Start Podman or Docker, then run stam setup' };
    }
}

function row(label: string, result: CheckResult): string[] {
    return [label, statusCell(result.ok ? 'ready' : 'missing'), result.manualFix ? `${result.details} (${result.manualFix})` : result.details];
}
