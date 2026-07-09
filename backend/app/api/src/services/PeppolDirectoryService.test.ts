import { PeppolEndointId } from '@stamhoofd/structures';
import { STExpect } from '@stamhoofd/test-utils';
import nock from 'nock';
import { PeppolDirectoryService } from './PeppolDirectoryService.js';

const DIRECTORY_HOST = 'https://directory.peppol.eu';
const DIRECTORY_PATH = '/search/1.0/json';

describe('PeppolDirectoryService', () => {
    /**
     * Mocks the PEPPOL directory search endpoint for a given participant query.
     * Returns the nock scope so tests can assert whether it was actually called.
     */
    function mockDirectory(participant: string, response: unknown, statusCode = 200) {
        return nock(DIRECTORY_HOST)
            .get(DIRECTORY_PATH)
            .query({ participant })
            .reply(statusCode, response as nock.Body);
    }

    /**
     * A directory response that contains a single match for the given participant value.
     */
    function matchResponse(value: string) {
        return {
            version: '1.0',
            'total-result-count': 1,
            matches: [
                {
                    participantID: { scheme: 'iso6523-actorid-upis', value },
                    entities: [{ name: [{ name: 'Demo Company' }], countryCode: 'BE' }],
                },
            ],
        };
    }

    afterEach(() => {
        nock.cleanAll();
        nock.disableNetConnect();
    });

    test('resolves when the participant is registered in the directory', async () => {
        const scope = mockDirectory('iso6523-actorid-upis::0208:0123456789', matchResponse('0208:0123456789'));

        const endpointId = PeppolEndointId.create({ schemeID: '0208', id: '0123456789' });
        await expect(PeppolDirectoryService.validate(endpointId)).resolves.toBeUndefined();

        expect(scope.isDone()).toBe(true);
        // The registered entity name from the directory is stored on the endpoint id.
        expect(endpointId.entityName).toBe('Demo Company');
    });

    test('overwrites a pre-existing entityName with the value from the directory', async () => {
        mockDirectory('iso6523-actorid-upis::0208:0123456789', matchResponse('0208:0123456789'));

        const endpointId = PeppolEndointId.create({ schemeID: '0208', id: '0123456789', entityName: 'Client supplied name' });
        await PeppolDirectoryService.validate(endpointId);

        expect(endpointId.entityName).toBe('Demo Company');
    });

    test('sets entityName to null when the directory match has no entity name', async () => {
        mockDirectory('iso6523-actorid-upis::0208:0123456789', {
            'total-result-count': 1,
            matches: [{ participantID: { scheme: 'iso6523-actorid-upis', value: '0208:0123456789' }, entities: [] }],
        });

        const endpointId = PeppolEndointId.create({ schemeID: '0208', id: '0123456789', entityName: 'stale' });
        await PeppolDirectoryService.validate(endpointId);

        expect(endpointId.entityName).toBeNull();
    });

    test('trims whitespace around the scheme and id before querying', async () => {
        const scope = mockDirectory('iso6523-actorid-upis::0088:5412345000013', matchResponse('0088:5412345000013'));

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: ' 0088 ', id: ' 5412345000013 ' })),
        ).resolves.toBeUndefined();

        expect(scope.isDone()).toBe(true);
    });

    test('rejects an unsupported scheme without contacting the directory', async () => {
        const scope = mockDirectory('iso6523-actorid-upis::9999:123', matchResponse('9999:123'));

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: '9999', id: '123' })),
        ).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'customPeppolEndpointId' }));

        expect(scope.isDone()).toBe(false);
    });

    test('rejects an empty id without contacting the directory', async () => {
        const scope = mockDirectory('iso6523-actorid-upis::0208:', matchResponse('0208:'));

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: '0208', id: '   ' })),
        ).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'customPeppolEndpointId' }));

        expect(scope.isDone()).toBe(false);
    });

    test('rejects when the participant is not found in the directory', async () => {
        mockDirectory('iso6523-actorid-upis::0060:123456789', {
            version: '1.0',
            'total-result-count': 0,
            matches: [],
        });

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: '0060', id: '123456789' })),
        ).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'customPeppolEndpointId' }));
    });

    test('rejects when the directory only returns a different participant', async () => {
        mockDirectory('iso6523-actorid-upis::0208:0123456789', matchResponse('0208:9999999999'));

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: '0208', id: '0123456789' })),
        ).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'customPeppolEndpointId' }));
    });

    test('throws service_unavailable when the directory errors out', async () => {
        mockDirectory('iso6523-actorid-upis::0208:0123456789', { message: 'Internal Server Error' }, 500);

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: '0208', id: '0123456789' })),
        ).rejects.toThrow(STExpect.simpleError({ code: 'service_unavailable', field: 'customPeppolEndpointId' }));
    });

    test('throws service_unavailable when the directory returns an unexpected response', async () => {
        mockDirectory('iso6523-actorid-upis::0208:0123456789', { unexpected: true });

        await expect(
            PeppolDirectoryService.validate(PeppolEndointId.create({ schemeID: '0208', id: '0123456789' })),
        ).rejects.toThrow(STExpect.simpleError({ code: 'service_unavailable', field: 'customPeppolEndpointId' }));
    });
});
