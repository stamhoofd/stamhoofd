import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { DevTarget, openDevSession } from '../workflows/start-dev.js';
import { startDevTraceView } from './dev-trace-view.js';

const fixture = fileURLToPath(new URL('./fixtures/dev-trace-producer.mjs', import.meta.url));
const run = promisify(execFile);
async function produce(env: NodeJS.ProcessEnv, app: string, ...args: string[]) {
    const { stdout } = await run(process.execPath, [fixture, app, ...args], { env });
    return stdout.trim();
}

it('renders the same local request and job spans at all three levels, including a late renderer continuation', async () => {
    const normal: string[] = [],
        quiet: string[] = [],
        full: string[] = [],
        summaries: string[] = [];
    const session = await openDevSession(
        DevTarget.Backend,
        undefined,
        () => {},
        undefined,
        (block) => normal.push(block),
    );
    const id = session.env.STAM_DEV_SESSION;
    const stopQuiet = startDevTraceView(id, (block) => quiet.push(block), {
        quiet: true,
        detail: 'full',
    });
    const stopSummary = startDevTraceView(id, (block) => summaries.push(block), {
        detail: 'summary',
        quiet: true,
    });
    const stopVerbose = startDevTraceView(id, (block) => full.push(block), {
        detail: 'full',
    });
    try {
        const [parents] = await Promise.all([
            produce(session.env, 'api'),
            produce(session.env, 'stats'),
        ]);
        const links = parents.split('\n');
        expect(links).toHaveLength(2);
        for (const link of links) expect(link).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
        await produce(session.env, 'renderer', ...links);
        await expect.poll(() => full.some((block) => /Render PDF +retry 0/.test(block))).toBe(true);
    } finally {
        stopQuiet();
        stopSummary();
        stopVerbose();
        await session.close();
    }
    const unique = (blocks: string[]) =>
        new Set(blocks.map((block) => block.match(/#(\w+)/)?.[1])).size;
    expect(unique(normal)).toBe(6);
    expect(unique(quiet)).toBe(4);
    expect(unique(summaries)).toBe(4);
    expect(summaries.every((block) => block.trim().split('\n').length === 1)).toBe(true);
    expect(summaries.join('')).toContain(
        'Write to storage  failed  HTTP 503  HTTP status  retry 3',
    );
    expect(summaries.join('')).toContain('MySQL pool checkout  failed  pool');
    expect(unique(full)).toBe(6);
    for (const output of [normal, quiet, full]) {
        const blocks = output.map((block) => block.replace(/(\S) {2,}(?=\S)/g, '$1  '));
        const response = blocks.findLast((block) =>
            block.includes('Call renderer  failed  HTTP 500'),
        )!;
        expect(response).toContain('└─ api  PATCH /invoices');
        expect(response).toMatch(/^ {3}[├└]─ Queue execution/m);
        expect(response).toContain('Call renderer  failed  HTTP 500  HTTP status');
        expect(response).toContain('└─ → renderer  POST /html-to-pdf');
        expect(response).toContain('└─ Render PDF  failed  render  retry 2');
        const upload = blocks.findLast((block) => block.includes('Write to storage'))!;
        expect(upload).toContain('Upload invoice  failed  upload');
        expect(upload).toContain('└─ Write to storage  failed  HTTP 503  HTTP status  retry 3');
        expect(upload).toContain('Render PDF  retry 0');
        const timeout = blocks.find((block) => block.includes('failed  timeout'))!;
        expect(timeout).toContain('Call renderer  failed  timeout');
        expect(timeout).not.toContain('HTTP status');
        const job = blocks.findLast((block) => block.includes('failed  pool'))!;
        expect(job).toContain('└─ stats  Statistics cycle');
        expect(job).toContain('   └─ Sync statistics changes');
        expect(job).toContain('      └─ MySQL pool checkout  failed  pool');
        expect(blocks.join('')).not.toContain('private');
    }
    expect(full.join('')).toContain('GET GetInvoicesCountEndpoint');
    expect(full.join('')).toContain('Authenticate bearer');
    expect(full.join('')).toContain('SQL SELECT tokens, users, user_sessions');
    expect(full.join('')).toContain('Queue wait');
    expect(full.join('')).toContain('SQL SELECT invoices');
    expect(quiet.join('')).toContain('Queue wait');
    expect(quiet.join('')).not.toContain('SQL SELECT');
});

it.each([
    ['PATCH /invoices', 'api', 'PATCH /invoices'],
    ['statistics.cycle', 'stats', 'Statistics cycle'],
])('captures every %s root and excludes nonmatching roots', async (selector, app, label) => {
    const blocks: string[] = [];
    const session = await openDevSession(
        DevTarget.Backend,
        selector,
        () => {},
        undefined,
        (block) => blocks.push(block),
    );
    try {
        await Promise.all([produce(session.env, 'stats'), produce(session.env, 'api')]);
    } finally {
        await session.close();
    }
    const ids = new Set(blocks.map((b) => b.match(/#(\w+)/)?.[1]));
    expect(ids.size).toBe(app === 'api' ? 3 : 2);
    for (const block of blocks) {
        expect(block).toContain(label);
        expect(block).not.toContain(app === 'api' ? 'Statistics cycle' : 'PATCH /invoices');
    }
});
