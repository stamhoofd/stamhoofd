import { test, setup } from '../test-fixtures/base.js';
setup();

import { expect } from '@playwright/test';
import { CSP_NONCE_PLACEHOLDER, getProjectPath } from '@stamhoofd/cli';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkerData } from '../helpers/worker/WorkerData.js';
import { CaddyConfigHelper } from '../setup/helpers/CaddyConfigHelper.js';

for (const service of ['dashboard', 'registration', 'webshop'] as const) {
    test(`${service} serves worker-specific HTML and unchanged assets @frontend-service`, async ({ request }) => {
        const port = CaddyConfigHelper.getFrontendPort(service, WorkerData.id!);
        const url = `http://127.0.0.1:${port}`;
        const response = await request.get(url);
        expect(response.ok()).toBe(true);
        const html = await response.text();
        expect(html).toContain(`<script nonce="${CSP_NONCE_PLACEHOLDER}" src="${WorkerData.urls.api}/frontend-environment"></script>`);
        expect(html).not.toContain('<!--IMPORT_ENV-->');

        for (const path of ['/index.html', '/nested/client/route']) {
            const fallback = await request.get(url + path);
            expect(fallback.ok()).toBe(true);
            expect(await fallback.text()).toBe(html);
        }

        const root = join(getProjectPath(), 'frontend/app', service === 'webshop' ? 'webshop' : 'web-app', 'dist-playwright');
        const sourceHtml = await readFile(join(root, 'index.html'), 'utf8');
        expect(sourceHtml).toContain('<!--IMPORT_ENV-->');
        const assetPath = /src="(\/assets\/[^"?]+\.js)"/.exec(sourceHtml)?.[1];
        expect(assetPath).toBeDefined();
        const asset = await request.get(url + assetPath!);
        expect(asset.ok()).toBe(true);
        expect(await asset.body()).toEqual(await readFile(join(root, assetPath!)));
    });
}
