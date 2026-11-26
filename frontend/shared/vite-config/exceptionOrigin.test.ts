import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';

it('only sends the public first-party Origin, never a tenant or embedding origin', async () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'origin-wire-'));
    try {
        const key = path.join(tmp, 'test.key'), cert = path.join(tmp, 'test.crt');
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=fixture.invalid', '-days', '1', '-keyout', key, '-out', cert], { stdio: 'ignore' });
        const components = path.resolve(import.meta.dirname, '../components');
        writeFileSync(path.join(tmp, 'entry.ts'), `
            import { configureVueExceptions } from ${JSON.stringify(path.join(components, 'src/errors/vue-exceptions.ts'))};
            import { createApp } from ${JSON.stringify(path.join(components, 'node_modules/vue/dist/vue.runtime.esm-bundler.js'))};
            export async function probe(dsn) {
                const defect = new TypeError('member-canary');
                const app = createApp({ mounted() { throw defect; }, render() {} });
                app.config.errorHandler = () => {};
                const client = configureVueExceptions(app, { browserOrigin: 'https://approved.invalid', service: 'web-app', dsn }, url => url === import.meta.url ? { id: '84ef940a-247c-421a-a31c-e65c08aa6254', lengths: Array(100000).fill(100000) } : undefined);
                app.mount(document.createElement('div'));
                await new Promise(resolve => setTimeout(resolve, 10));
                window.dispatchEvent(new ErrorEvent('error', { error: defect }));
                window.dispatchEvent(new ErrorEvent('error', { error: new RangeError('member-canary') }));
                await client?.flush(1000);
                return !!client?.getDsn();
            }
        `);
        await build({ root: tmp, define: { 'process.env.NODE_ENV': JSON.stringify('production') }, configFile: false, logLevel: 'silent', build: {
            lib: { entry: path.join(tmp, 'entry.ts'), formats: ['es'], fileName: () => 'errors.js' },
        } });
        const module = readFileSync(path.join(tmp, 'dist/errors.js'));
        const allowed = 'https://approved.invalid';
        const custom = 'https://member-canary.invalid';
        const wire: { origin?: string; referrer?: string; body: string }[] = [];
        const server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, async (req, res) => {
            if (req.url?.startsWith('/api/')) {
                const chunks = [];
                for await (const chunk of req) chunks.push(Buffer.from(chunk));
                wire.push({ origin: req.headers.origin, referrer: req.headers.referer, body: Buffer.concat(chunks).toString() });
                res.setHeader('Access-Control-Allow-Origin', allowed);
            } else if (req.url === '/errors.js') {
                res.setHeader('content-type', 'application/javascript');
                res.end(module);
                return;
            } else {
                res.setHeader('content-type', 'text/html');
                res.end(req.url === '/embed' ? `<iframe src="${allowed}"></iframe>` : '<body></body>');
                return;
            }
            res.end('{}');
        }).listen(0, '127.0.0.1');
        await once(server, 'listening');
        try {
            const address = server.address();
            if (!address || typeof address === 'string') throw Error('Expected local listener');
            const browser = await chromium.launch({ args: ['--no-proxy-server', `--host-resolver-rules=MAP * 127.0.0.1:${address.port}`] });
            try {
                const page = await browser.newPage({ ignoreHTTPSErrors: true });
                const probe = `async () => {
                    const api = await import('/errors.js');
                    return api.probe('https://test@fixture.betterstackdata.com/1');
                }`;
                await page.goto(custom);
                expect(await page.evaluate(`(${probe})()`)).toBe(false);
                await page.goto(custom + '/embed');
                expect(await page.frames()[1].evaluate(`(${probe})()`)).toBe(false);
                await page.goto(allowed);
                expect(await page.evaluate(`(${probe})()`)).toBe(true);
                expect(wire).toHaveLength(2);
                expect(JSON.parse(wire[1].body.split('\n')[2]).tags.boundary).toBe('browser.global');
                expect(wire[0].origin).toBe(allowed);
                expect(wire[0].referrer).toBeUndefined();
                expect(JSON.stringify(wire)).not.toContain('canary');
                expect(JSON.parse(wire[0].body.split('\n')[2]).tags.boundary).toBe('browser.vue');
                await page.reload();
                expect(await page.evaluate(`import('/errors.js').then(api => api.probe('invalid-dsn'))`)).toBe(false);
                expect(wire).toHaveLength(2);
            } finally { await browser.close(); }
        } finally {
            server.closeAllConnections();
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    } finally { rmSync(tmp, { recursive: true, force: true }); }
}, 20_000);
