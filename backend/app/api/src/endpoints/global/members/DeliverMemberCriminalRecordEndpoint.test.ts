import { Request } from '@node/endpoints';
import { blankExtractLines, createTestPdf } from '@stamhoofd/criminal-record-check/testing/index.js';
import type { RateLimiter } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { CriminalRecordCheck, CriminalRecordCheckExplanation, CriminalRecordCheckStatus, CriminalRecordStatus, MemberDetails } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { promises as fs } from 'fs';
import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { criminalRecordMemberLimiter, criminalRecordUserLimiter, DeliverMemberCriminalRecordEndpoint } from './DeliverMemberCriminalRecordEndpoint.js';

const endpoint = new DeliverMemberCriminalRecordEndpoint();

function resetLimiter(limiter: RateLimiter) {
    for (const window of limiter.windows) {
        window.windows.clear();
        window.start = new Date();
    }
}

describe('Endpoint.DeliverMemberCriminalRecord', () => {
    /** The paths the endpoint cleaned up */
    let removedFiles: string[] = [];

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');

        resetLimiter(criminalRecordMemberLimiter);
        resetLimiter(criminalRecordUserLimiter);

        removedFiles = [];
        const rm = fs.rm;
        vi.spyOn(fs, 'rm').mockImplementation(async (path, options) => {
            removedFiles.push(path as string);
            return await rm(path, options);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * A member of 20, with an account that manages them.
     */
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

    /**
     * An extract for this member, issued today, so only the signature is missing.
     */
    function validExtract(overrides: Parameters<typeof blankExtractLines>[0] = {}) {
        const issuedAt = new Date();
        const documentDate = `Datum: ${issuedAt.getDate()}/${issuedAt.getMonth() + 1}/${issuedAt.getFullYear()}`;

        return createTestPdf(blankExtractLines({
            lastName: 'Naam: JANSSENS',
            firstName: 'Voorna(a)m(en): Jan',
            birthDate: 'Geboortedatum: 05/04/2006',
            documentDate,
            ...overrides,
        }).map((text, index) => ({ text, y: 800 - index * 20 })));
    }

    /**
     * Builds the multipart request a browser sends: the pdf, plus the consent of the member.
     */
    function buildRequest({ token, organizationHost, memberId, content, consent = 'true', includeFile = true }: {
        token: string;
        organizationHost: string;
        memberId: string;
        content?: Uint8Array;
        consent?: string | null;
        includeFile?: boolean;
    }) {
        const boundary = '--------------------------StamhoofdTest';
        const parts: Buffer[] = [];

        if (includeFile) {
            parts.push(
                Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="uittreksel.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
                Buffer.from(content ?? validExtract()),
                Buffer.from('\r\n'),
            );
        }

        if (consent !== null) {
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="consent"\r\n\r\n${consent}\r\n`));
        }

        parts.push(Buffer.from(`--${boundary}--\r\n`));
        const body = Buffer.concat(parts);

        const stream = Readable.from([body]) as unknown as IncomingMessage;
        stream.headers = {
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'content-length': body.length.toString(),
        };

        const request = Request.buildJson('POST', `/v1/members/${memberId}/criminal-record`, organizationHost);
        request.headers.authorization = 'Bearer ' + token;
        request.request = stream;

        return request;
    }

    test('It checks a delivered extract and sends it to a reviewer while the signature is not verified', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(response.body.status).toBe(CriminalRecordStatus.UnderReview);
        expect(response.body.checks.map(c => [c.check, c.status])).toEqual([
            [CriminalRecordCheck.Authentic, CriminalRecordCheckStatus.NotStarted],
            [CriminalRecordCheck.Identity, CriminalRecordCheckStatus.Passed],
            [CriminalRecordCheck.Model, CriminalRecordCheckStatus.Passed],
            [CriminalRecordCheck.Age, CriminalRecordCheckStatus.Passed],
            [CriminalRecordCheck.Blank, CriminalRecordCheckStatus.Passed],
        ]);
    });

    test('It removes the document after checking it', async () => {
        const { organization, token, member } = await setup();

        await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(removedFiles).toHaveLength(1);
        await expect(fs.access(removedFiles[0])).rejects.toThrow();
    });

    test('It rejects an extract of someone else', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            content: validExtract({ lastName: 'Naam: PEETERS' }),
        }));

        expect(response.body.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(response.body.checks.find(c => c.check === CriminalRecordCheck.Identity)?.explanation).toBe(CriminalRecordCheckExplanation.IdentityMismatch);
    });

    test('It rejects a file that is not a readable pdf', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            content: new Uint8Array(Buffer.from('a photo of an extract')),
        }));

        expect(response.body.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(response.body.checks.find(c => c.check === CriminalRecordCheck.Identity)?.explanation).toBe(CriminalRecordCheckExplanation.DocumentNotReadable);
    });

    test('It does not check the document without consent', async () => {
        const { organization, token, member } = await setup();

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            consent: 'false',
        }))).rejects.toThrow(STExpect.simpleError({ code: 'missing_consent' }));

        // The document is removed, also when it was not checked
        expect(removedFiles).toHaveLength(1);
    });

    test('It requires a file', async () => {
        const { organization, token, member } = await setup();

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            includeFile: false,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'missing_field' }));
    });

    test('It does not accept a delivery for a member the user cannot access', async () => {
        const { organization, member } = await setup();
        const other = await new UserFactory({ organization }).create();
        const otherToken = await SessionService.createSession(other);

        await expect(testServer.test(endpoint, buildRequest({
            token: otherToken.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('It limits the number of deliveries for one member', async () => {
        const { organization, token, member } = await setup();

        criminalRecordMemberLimiter.track(member.id, 10);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'too_many_requests' }));
    });
});
