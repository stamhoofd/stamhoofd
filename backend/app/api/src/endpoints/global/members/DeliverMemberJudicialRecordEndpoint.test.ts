import { Request } from '@node/endpoints';
import type { RateLimiter } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { JudicialRecordCheck, JudicialRecordCheckStatus, MemberDetails, Permissions, judicialRecordChecksInOrder } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { defaultOptions } from 'formidable';
import { promises as fs } from 'fs';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { DeliverMemberJudicialRecordEndpoint, judicialRecordMemberLimiter, judicialRecordUserLimiter, MAXIMUM_UPLOAD_SIZE } from './DeliverMemberJudicialRecordEndpoint.js';

const endpoint = new DeliverMemberJudicialRecordEndpoint();

function resetLimiter(limiter: RateLimiter) {
    for (const window of limiter.windows) {
        window.windows.clear();
        window.start = new Date();
    }
}

describe('Endpoint.DeliverMemberJudicialRecord', () => {
    /**
     * Every multipart write of a test lands here, both the directory the endpoint allocates and
     * formidable's own default, so what is left behind after a test is visible.
     */
    let uploadDirectory: string;
    const originalUploadDirectory = defaultOptions.uploadDir;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        // The limiters are process wide, so a test would otherwise inherit the attempts of the one before it
        resetLimiter(judicialRecordMemberLimiter);
        resetLimiter(judicialRecordUserLimiter);

        uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'judicial-record-test-'));
        vi.stubEnv('TMPDIR', uploadDirectory);
        defaultOptions.uploadDir = uploadDirectory;
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        defaultOptions.uploadDir = originalUploadDirectory;
        await fs.rm(uploadDirectory, { recursive: true, force: true });
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

    /**
     * The multipart request a browser sends: the pdf and nothing else.
     *
     * The document is not a real extract. A valid one has to be signed by FOD Justitie itself, which
     * needs their private key, and a real extract holds someone's name, birth date and address - so
     * none is committed. What the checks make of a document is covered on the service; what this
     * endpoint does around them does not depend on the document holding up.
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
                Buffer.from(content ?? new TextEncoder().encode('Dit is geen pdf.')),
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

        const request = Request.buildJson('POST', `/v1/members/${memberId}/judicial-record`, organizationHost);
        request.headers.authorization = 'Bearer ' + token;
        request.request = stream;

        return request;
    }

    test('It answers with the result of every check', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(response.body.getChecks().map(result => result.check)).toEqual([...judicialRecordChecksInOrder]);
        expect(response.body.isPassed).toBe(false);

        // A document we cannot place as one of FOD Justitie is never read, so only the signature has a verdict
        expect(response.body.get(JudicialRecordCheck.Authentic)!.isFailed).toBe(true);
        expect(response.body.get(JudicialRecordCheck.Identity)!.status).toBe(JudicialRecordCheckStatus.Pending);

        for (const result of response.body.getChecks()) {
            expect(result.reason, result.check).not.toBe('');
        }
    });

    test('It removes the delivered document, also when nothing approved it', async () => {
        const { organization, token, member } = await setup();

        await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(await fs.readdir(uploadDirectory)).toEqual([]);
    });

    test('It refuses a file larger than it is willing to read', async () => {
        const { organization, token, member } = await setup();

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
            content: new Uint8Array(MAXIMUM_UPLOAD_SIZE + 1),
        }))).rejects.toThrow(STExpect.simpleError({ code: 'file_too_large' }));

        expect(await fs.readdir(uploadDirectory)).toEqual([]);
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

    test('It does not accept a delivery from an account the member is not linked to', async () => {
        const { organization, member } = await setup();
        const other = await new UserFactory({ organization }).create();
        const otherToken = await SessionService.createSession(other);

        await expect(testServer.test(endpoint, buildRequest({
            token: otherToken.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('It does not accept a delivery from an administrator of the member', async () => {
        const { organization, member } = await setup();
        const admin = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const adminToken = await SessionService.createSession(admin);

        // Full access to the member is not enough: an administrator reading an extract of someone
        // else needs a right of its own, which arrives with the review flow
        await expect(testServer.test(endpoint, buildRequest({
            token: adminToken.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });

    test('It limits the number of deliveries for one member', async () => {
        const { organization, token, member } = await setup();

        judicialRecordMemberLimiter.track(member.id, 10);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'too_many_requests' }));
    });
});
