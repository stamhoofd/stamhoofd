import { BelcotaxConnection } from '@stamhoofd/models';
import { TestUtils } from '@stamhoofd/test-utils';
import type { BelcotaxFodMocker } from '../../../../tests/helpers/BelcotaxFodMocker.js';
import {
    belcotaxCompanyNumber,
    connectBelcotax,
    initBelcotaxApi,
    initBelcotaxOrganization,
} from '../../../../tests/init/initBelcotax.js';
import { BelcotaxConfig } from '../connection/BelcotaxConfig.js';
import { BelcotaxConnectionService } from '../connection/BelcotaxConnectionService.js';
import { BelcotaxBulkApiMock } from './BelcotaxBulkApiMock.js';
import { BelcotaxMockBulks } from './BelcotaxBulkApiMockBulks.js';

describe('BelcotaxBulkApiMock', () => {
    let fod: BelcotaxFodMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        fod = initBelcotaxApi('local');
    });

    test('accepts the access tokens of the authorization server and nothing else', async () => {
        expect(
            await BelcotaxBulkApiMock.handle('GET', '/bulks/1/validations/last', undefined),
        ).toMatchObject([401, { type: 'urn:problem-type:belgif:noAccessToken' }]);
        expect(
            await BelcotaxBulkApiMock.handle('GET', '/bulks/1/validations/last', 'Bearer made-up'),
        ).toMatchObject([401, { type: 'urn:problem-type:belgif:invalidAccessToken' }]);

        const context = await initBelcotaxOrganization();
        await connectBelcotax(fod, context, context.company.id);
        const connection = (await BelcotaxConnection.getFor(
            context.organization.id,
            belcotaxCompanyNumber,
        ))!;

        const seen: string[] = [];
        BelcotaxBulkApiMock.routes.push({
            method: 'GET',
            path: /^\/bulks\/([^/]+)\/validations\/last$/,
            handle: (request) => {
                seen.push(request.companyNumber + ' ' + request.match[1]);
                return [200, { status: 'ACCEPTED' }];
            },
        });
        try {
            const response = await BelcotaxConnectionService.run(
                connection,
                async (api) =>
                    await api.request({ method: 'GET', path: '/bulks/42/validations/last' }),
            );
            expect(response).toEqual({ status: 200, json: { status: 'ACCEPTED' } });
            expect(seen).toEqual([belcotaxCompanyNumber + ' 42']);
        } finally {
            BelcotaxBulkApiMock.routes.pop();
        }
    });

    test('keeps a bulk for the company that submitted it', async () => {
        const context = await initBelcotaxOrganization();
        await connectBelcotax(fod, context, context.company.id);
        const connection = (await BelcotaxConnection.getFor(
            context.organization.id,
            belcotaxCompanyNumber,
        ))!;

        const responses = await BelcotaxConnectionService.run(connection, async (api) => {
            const missing = await api.request({
                method: 'POST',
                path: '/bulks/submit',
                body: new FormData(),
            });

            const form = new FormData();
            form.append('content', new Blob(['{"$s":"urn:r:d:c:1:nl","k":"c"}\n']), 'file.jsonl');
            const submitted = await api.request({
                method: 'POST',
                path: '/bulks/submit',
                body: form,
            });
            const id = (submitted.json as { id: string }).id;

            return {
                missing,
                submitted,
                first: await api.request({ method: 'GET', path: `/bulks/${id}/validations/last` }),
                second: await api.request({ method: 'GET', path: `/bulks/${id}/validations/last` }),
                feedback: await api.request({
                    method: 'GET',
                    path: `/bulks/${id}/validations/last/feedback`,
                }),
                unknown: await api.request({
                    method: 'GET',
                    path: '/bulks/other/validations/last',
                }),
            };
        });

        expect(responses.missing.status).toBe(400);
        expect(responses.submitted).toMatchObject({ status: 200, json: { count: 1 } });
        expect(responses.first.json).toMatchObject({ status: 'inProgress' });
        expect(responses.second.json).toMatchObject({ status: 'accepted' });
        expect(responses.feedback).toMatchObject({ status: 200, json: { status: 'accepted' } });
        expect(responses.unknown.status).toBe(404);
        expect(BelcotaxMockBulks.files).toEqual(['{"$s":"urn:r:d:c:1:nl","k":"c"}\n']);
    });

    test('is only served for the local environment outside production', () => {
        expect(BelcotaxConfig.servesMockApi).toBe(true);

        TestUtils.setEnvironment('environment', 'production');
        expect(BelcotaxConfig.servesMockApi).toBe(false);
        expect(BelcotaxConfig.environment).toBeNull();

        TestUtils.setEnvironment('environment', 'staging');
        TestUtils.setEnvironment('BELCOTAX_ENVIRONMENT', 'acceptance');
        expect(BelcotaxConfig.servesMockApi).toBe(false);
    });
});
