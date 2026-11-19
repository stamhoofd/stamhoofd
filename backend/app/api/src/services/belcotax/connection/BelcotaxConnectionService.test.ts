import { BelcotaxApiLog, BelcotaxApiLogAction, BelcotaxConnection } from '@stamhoofd/models';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import type { BelcotaxFodMocker } from '../../../../tests/helpers/BelcotaxFodMocker.js';
import {
    belcotaxCompanyNumber,
    connectBelcotax,
    initBelcotaxApi,
    initBelcotaxOrganization,
} from '../../../../tests/init/initBelcotax.js';
import { BelcotaxConnectionService } from './BelcotaxConnectionService.js';

describe('BelcotaxConnectionService', () => {
    let fod: BelcotaxFodMocker;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        fod = initBelcotaxApi();
    });

    async function initConnection() {
        const context = await initBelcotaxOrganization();
        await connectBelcotax(fod, context, context.company.id);
        const connection = (await BelcotaxConnection.getFor(
            context.organization.id,
            belcotaxCompanyNumber,
        ))!;
        return { ...context, connection };
    }

    function getRefreshRequests() {
        return fod.requests.filter((r) => r.body.grant_type === 'refresh_token');
    }

    test('every action refreshes the single use refresh token and extends the connection', async () => {
        const { connection } = await initConnection();
        const firstRefreshToken = connection.refreshToken!;
        connection.validUntil = new Date(Date.now() + 60 * 1000);
        await connection.save();

        const response = await BelcotaxConnectionService.run(connection, async (api) => {
            return await api.request({ method: 'GET', path: '/bulks/unknown/validations/last' });
        });

        // The mock knows the access token: it answers with a 404 instead of a 401
        expect(response.status).toBe(404);

        await connection.refresh();
        expect(connection.refreshToken).not.toBe(firstRefreshToken);
        expect(connection.validUntil.getTime()).toBeGreaterThan(
            Date.now() + 6.9 * 24 * 60 * 60 * 1000,
        );
        expect(getRefreshRequests()).toHaveLength(1);
        expect(getRefreshRequests()[0].body.refresh_token).toBe(firstRefreshToken);

        const logs = await BelcotaxApiLog.select().where('connectionId', connection.id).fetch();
        expect(logs.map((l) => l.action).sort()).toEqual(
            [
                BelcotaxApiLogAction.ApiCall,
                BelcotaxApiLogAction.Callback,
                BelcotaxApiLogAction.TokenRefresh,
            ].sort(),
        );
        expect(logs.find((l) => l.action === BelcotaxApiLogAction.ApiCall)).toMatchObject({
            method: 'GET',
            statusCode: 404,
            success: false,
            companyNumber: belcotaxCompanyNumber,
        });
    });

    test('parallel actions for the same company wait for each other', async () => {
        const { connection } = await initConnection();
        const other = (await BelcotaxConnection.getByID(connection.id))!;

        // Without the lock both would present the same refresh token and the second would end the connection
        const results = await Promise.all([
            BelcotaxConnectionService.run(
                connection,
                async (api) =>
                    (await api.request({ method: 'GET', path: '/bulks/a/validations/last' }))
                        .status,
            ),
            BelcotaxConnectionService.run(
                other,
                async (api) =>
                    (await api.request({ method: 'GET', path: '/bulks/b/validations/last' }))
                        .status,
            ),
        ]);

        expect(results).toEqual([404, 404]);
        const refreshTokens = getRefreshRequests().map((r) => r.body.refresh_token);
        expect(new Set(refreshTokens).size).toBe(2);
        expect((await BelcotaxConnection.getByID(connection.id))!.isValid).toBe(true);
    });

    test('an access token that expired during an action is refreshed again', async () => {
        const { connection } = await initConnection();

        const statuses = await BelcotaxConnectionService.run(connection, async (api) => {
            const first = await api.request({ method: 'GET', path: '/bulks/a/validations/last' });
            // Our copy still looks valid, but FOD answers 401
            fod.forcedApiResponses.push({ status: 401, body: {} });
            const second = await api.request({ method: 'GET', path: '/bulks/a/validations/last' });
            return [first.status, second.status];
        });

        expect(statuses).toEqual([404, 404]);
        expect(getRefreshRequests()).toHaveLength(2);
    });

    test('a refused refresh token ends the connection', async () => {
        const { connection, organization } = await initConnection();
        fod.expireRefreshTokens();

        await expect(
            BelcotaxConnectionService.run(connection, async () => 'unreachable'),
        ).rejects.toThrow(STExpect.simpleError({ code: 'belcotax_connection_expired' }));

        const stored = (await BelcotaxConnection.getFor(organization.id, belcotaxCompanyNumber))!;
        expect(stored.refreshToken).toBeNull();
        expect(stored.isValid).toBe(false);
        expect(stored.getStructure().isValid).toBe(false);

        // Nothing is sent to FOD any more until a legal representative logs in again
        const requests = fod.requests.length;
        await expect(
            BelcotaxConnectionService.run(stored, async () => 'unreachable'),
        ).rejects.toThrow(STExpect.simpleError({ code: 'belcotax_connection_expired' }));
        expect(fod.requests.length).toBe(requests);
    });

    test('a connection past its validity is not refreshed', async () => {
        const { connection } = await initConnection();
        connection.validUntil = new Date(Date.now() - 1000);
        await connection.save();

        await expect(
            BelcotaxConnectionService.run(connection, async () => 'unreachable'),
        ).rejects.toThrow(STExpect.simpleError({ code: 'belcotax_connection_expired' }));
        expect(getRefreshRequests()).toHaveLength(0);
    });

    test('logs when FOD is unreachable', async () => {
        const { connection } = await initConnection();
        fod.stop();

        await expect(
            BelcotaxConnectionService.run(connection, async () => 'unreachable'),
        ).rejects.toThrow(STExpect.simpleError({ code: 'belcotax_unreachable' }));
        const log = await BelcotaxApiLog.select()
            .where('connectionId', connection.id)
            .andWhere('action', BelcotaxApiLogAction.TokenRefresh)
            .first(true);
        expect(log).toMatchObject({ success: false, statusCode: null });
        expect(log.error).toBeTruthy();
    });
});
