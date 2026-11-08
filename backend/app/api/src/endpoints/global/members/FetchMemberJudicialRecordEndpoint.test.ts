import { Request } from '@node/endpoints';
import type { RateLimiter } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { MemberDetails, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import type { MockedFunction } from 'vitest';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { MAXIMUM_UPLOAD_SIZE } from './DeliverMemberJudicialRecordEndpoint.js';
import { FetchMemberJudicialRecordEndpoint, judicialRecordFetchMemberLimiter, judicialRecordFetchUserLimiter } from './FetchMemberJudicialRecordEndpoint.js';

const endpoint = new FetchMemberJudicialRecordEndpoint();

/** A url of the accepted shape that FOD Justitie answers without a pdf, so it is safe to write down. */
const EXPIRED_URL = 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS';

/** The shortest thing that passes for a pdf: what is in it is the delivery's business, not this endpoint's. */
const PDF = Buffer.from('%PDF-1.5\n%%EOF\n');

function resetLimiter(limiter: RateLimiter) {
    for (const window of limiter.windows) {
        window.windows.clear();
        window.start = new Date();
    }
}

describe('Endpoint.FetchMemberJudicialRecord', () => {
    /**
     * Every test replaces fetch, so nothing here reaches FOD Justitie. The default answers the one
     * thing a working link answers; a test that needs another response installs its own.
     */
    let fetchMock: MockedFunction<typeof fetch>;

    function respondWith(body: Buffer | string, { status = 200, contentType = 'application/pdf' }: { status?: number; contentType?: string } = {}) {
        // Copied out of the buffer pool a Buffer lives in, so the response holds these bytes and nothing around them
        const content = typeof body === 'string' ? body : (new Uint8Array(body).buffer as ArrayBuffer);

        fetchMock.mockImplementation(() => Promise.resolve(new globalThis.Response(content, {
            status,
            headers: { 'content-type': contentType },
        })));
    }

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');

        // The limiters are process wide, so a test would otherwise inherit the attempts of the one before it
        resetLimiter(judicialRecordFetchMemberLimiter);
        resetLimiter(judicialRecordFetchUserLimiter);

        fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal('fetch', fetchMock);
        respondWith(PDF);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** A member of 20 with an account of their own. */
    async function setup() {
        const organization = await new OrganizationFactory({}).create();
        const user = await new UserFactory({ organization }).create();
        const token = await SessionService.createSession(user);

        const member = await new MemberFactory({
            organization,
            user,
            details: MemberDetails.create({
                firstName: 'Jan',
                lastName: 'Janssens',
                birthDay: new Date(Date.UTC(2006, 3, 5)),
            }),
        }).create();

        return { organization, user, token, member };
    }

    function buildRequest({ token, organizationHost, memberId, url }: {
        token: string;
        organizationHost: string;
        memberId: string;
        url: string;
    }) {
        const request = Request.buildJson('POST', `/v1/members/${memberId}/judicial-record/fetch`, organizationHost, { url });
        request.headers.authorization = 'Bearer ' + token;

        return request;
    }

    test('It answers with the pdf FOD Justitie returned', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }));

        expect(Buffer.from(response.body!)).toEqual(PDF);

        // Never rendered on our own origin: it is somebody else's document
        expect(response.headers['content-type']).toBe('application/octet-stream');
        expect(response.headers['content-disposition']).toBe('attachment; filename="uittreksel.pdf"');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('It calls FOD Justitie without following a redirect and with a timeout', async () => {
        const { organization, token, member } = await setup();

        await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];

        expect(url).toBe(EXPIRED_URL);
        expect(init?.method).toBe('GET');
        expect(init?.redirect).toBe('error');
        expect(init?.credentials).toBe('omit');
        expect(init?.referrerPolicy).toBe('no-referrer');
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    describe('It accepts no other url than the one FOD Justitie prints', () => {
        const rejected = {
            'another host': 'https://just-crimeviewer-ctz.just.fgov.be.evil.example/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'a subdomain of the host': 'https://evil.just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'another host of FOD Justitie': 'https://just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'http': 'http://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'no scheme': 'just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'a file url': 'file:///etc/passwd',
            'an ip host': 'https://127.0.0.1/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'the metadata service': 'http://169.254.169.254/latest/meta-data/',
            'a port': 'https://just-crimeviewer-ctz.just.fgov.be:8080/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'credentials': 'https://user:password@just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'an uppercase uuid': 'https://just-crimeviewer-ctz.just.fgov.be/record/2331F637-9F30-46BD-9A3F-BE62FF76D7DC-CJCS',
            'an uppercase host': 'https://JUST-CRIMEVIEWER-CTZ.JUST.FGOV.BE/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'a suffix on the path': `${EXPIRED_URL}/download`,
            'a prefix on the path': 'https://just-crimeviewer-ctz.just.fgov.be/api/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'a traversal in the path': 'https://just-crimeviewer-ctz.just.fgov.be/record/../../2331f637-9f30-46bd-9a3f-be62ff76d7dc-CJCS',
            'a query string': `${EXPIRED_URL}?download=1`,
            'a fragment': `${EXPIRED_URL}#page=1`,
            'another document type': 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc-OTHER',
            'no document type': 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7dc',
            'a uuid that is not one': 'https://just-crimeviewer-ctz.just.fgov.be/record/2331f637-9f30-46bd-9a3f-be62ff76d7d-CJCS',
            'a newline and a second url': `${EXPIRED_URL}\nhttps://evil.example/`,
            'nothing at all': '',
        };

        test.each(Object.entries(rejected))('%s', async (_name, url) => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildRequest({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                url,
            }))).rejects.toThrow(STExpect.simpleError({ code: 'invalid_field', field: 'url' }));

            // A url we do not accept is never called
            expect(fetchMock).not.toHaveBeenCalled();
        });

        /**
         * Whitespace around the url is tolerated, since a QR reader appends a newline and a pasted
         * link brings along whatever was on the clipboard. It cannot reach FOD Justitie either way:
         * the url called is rebuilt from the uuid, so what is asserted here is that the request goes
         * to the canonical url and not to whatever was sent.
         */
        test.each([
            ['a trailing newline', `${EXPIRED_URL}\n`],
            ['a leading space', ` ${EXPIRED_URL}`],
            ['both', ` ${EXPIRED_URL}\n `],
        ])('it trims %s and calls the canonical url', async (_name, url) => {
            const { organization, token, member } = await setup();

            await testServer.test(endpoint, buildRequest({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                url,
            }));

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toBe(EXPIRED_URL);
        });
    });

    test('It refuses a link that no longer holds a pdf', async () => {
        const { organization, token, member } = await setup();

        // What the expired link really answers: the viewer page, with a 200
        respondWith('<!DOCTYPE html><html lang="en"><head><title>Criminal Record</title></head></html>', { contentType: 'text/html;charset=utf-8' });

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'judicial_record_not_available' }));
    });

    test('It refuses a response that announces a pdf but is not one', async () => {
        const { organization, token, member } = await setup();

        respondWith('<html><script>alert(1)</script></html>', { contentType: 'application/pdf' });

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'judicial_record_not_available' }));
    });

    test('It refuses a response larger than it is willing to read', async () => {
        const { organization, token, member } = await setup();

        const tooLarge = Buffer.concat([PDF, Buffer.alloc(MAXIMUM_UPLOAD_SIZE)]);
        respondWith(tooLarge);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'judicial_record_not_available' }));
    });

    test('It refuses a response FOD Justitie answered with an error status', async () => {
        const { organization, token, member } = await setup();

        respondWith(PDF, { status: 404 });

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'judicial_record_not_available' }));
    });

    test('It refuses when FOD Justitie does not answer at all', async () => {
        const { organization, token, member } = await setup();

        fetchMock.mockImplementation(() => Promise.reject(new Error('fetch failed')));

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'judicial_record_not_available' }));
    });

    test('It does not fetch for an account the member is not linked to', async () => {
        const { organization, member } = await setup();
        const other = await new UserFactory({ organization }).create();
        const otherToken = await SessionService.createSession(other);

        await expect(testServer.test(endpoint, buildRequest({
            token: otherToken.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.errorWithCode('not_found'));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('It does not fetch for an administrator of the member', async () => {
        const { organization, member } = await setup();
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const adminToken = await SessionService.createSession(admin);

        // Same audience as delivering: an extract of someone else is not an administrator's to fetch
        await expect(testServer.test(endpoint, buildRequest({
            token: adminToken.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.errorWithCode('not_found'));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('It limits the number of fetches for one member', async () => {
        const { organization, token, member } = await setup();

        judicialRecordFetchMemberLimiter.track(member.id, 10);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'too_many_requests' }));

        expect(fetchMock).not.toHaveBeenCalled();
    });

    test('It limits the number of fetches for one account', async () => {
        const { organization, token, member, user } = await setup();

        judicialRecordFetchUserLimiter.track(user.id, 30);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            url: EXPIRED_URL,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'too_many_requests' }));

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
