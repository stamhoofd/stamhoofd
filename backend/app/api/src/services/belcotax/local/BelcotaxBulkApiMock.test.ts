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
