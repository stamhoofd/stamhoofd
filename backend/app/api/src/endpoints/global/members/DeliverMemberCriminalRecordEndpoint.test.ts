import { Request } from '@node/endpoints';
import { CRIMINAL_RECORD_MAX_FILE_SIZE } from '@stamhoofd/criminal-record-check/server/index.js';
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
     * A blank extract for this member, issued today. It carries a text layer but no signature:
     * signing one needs the private key of FOD Justitie, so the checks on the content are tested in
     * the package itself, with the signature result injected.
     */
    function unsignedExtract() {
        const issuedAt = new Date();

        return createTestPdf(blankExtractLines({
            lastName: 'Naam: JANSSENS',
            firstName: 'Voorna(a)m(en): Jan',
            birthDate: 'Geboortedatum: 05/04/2006',
            documentDate: `Datum: ${issuedAt.getDate()}/${issuedAt.getMonth() + 1}/${issuedAt.getFullYear()}`,
        }).map((text, index) => ({ text, y: 800 - index * 20 })));
    }

    /**
     * Builds the multipart request a browser sends: the pdf.
     */
    function buildRequest({ token, organizationHost, memberId, content, includeFile = true }: {
        token: string;
        organizationHost: string;
        memberId: string;
        content?: Uint8Array;
        includeFile?: boolean;
    }) {
        const boundary = '--------------------------StamhoofdTest';
        const parts: Buffer[] = [];

        if (includeFile) {
            parts.push(
                Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="uittreksel.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
                Buffer.from(content ?? unsignedExtract()),
                Buffer.from('\r\n'),
            );
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

    test('It rejects a delivered extract that is not signed by FOD Justitie', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        // Without a signature of FOD Justitie the content is never read
        expect(response.body.status).toBe(CriminalRecordStatus.AutomaticallyRejected);
        expect(response.body.checks.map(c => [c.check, c.status])).toEqual([
            [CriminalRecordCheck.Authentic, CriminalRecordCheckStatus.Failed],
            [CriminalRecordCheck.Identity, CriminalRecordCheckStatus.NotStarted],
            [CriminalRecordCheck.Model, CriminalRecordCheckStatus.NotStarted],
            [CriminalRecordCheck.Age, CriminalRecordCheckStatus.NotStarted],
            [CriminalRecordCheck.Blank, CriminalRecordCheckStatus.NotStarted],
        ]);
        expect(response.body.checks[0].explanation).toBe(CriminalRecordCheckExplanation.SignatureInvalid);
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

    test('It refuses a file that is too large to verify', async () => {
        const { organization, token, member } = await setup();

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            content: new Uint8Array(CRIMINAL_RECORD_MAX_FILE_SIZE + 1),
        }))).rejects.toThrow(STExpect.simpleError({ code: 'file_too_large' }));
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
