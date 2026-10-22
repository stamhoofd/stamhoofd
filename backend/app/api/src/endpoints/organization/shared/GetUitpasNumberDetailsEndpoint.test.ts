import { Request } from '@simonbackx/simple-endpoints';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';

import { testServer } from '../../../../tests/helpers/TestServer.js';
import { GetUitpasNumberDetailsEndpoint } from './GetUitpasNumberDetailsEndpoint.js';

describe('Endpoint.GetUitpasNumberDetails', () => {
    const endpoint = new GetUitpasNumberDetailsEndpoint();

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'platform');
    });

    test('Invalid UiTPAS numbers are rejected before calling UiTPAS', async () => {
        const r = Request.buildJson('GET', '/uitpas/details', undefined, undefined);
        r.query = { uitpasNumbers: JSON.stringify(['../organizers?x=1']) };

        await expect(testServer.test(endpoint, r)).rejects.toThrow(
            STExpect.simpleError({ code: 'invalid_uitpas_number', field: 'uitpasNumbers.0' }),
        );
    });
});
