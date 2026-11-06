import { SimpleError } from '@common/errors';
import { Request } from '@node/endpoints';
import type { RateLimiter } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { JudicialRecordDeliveryStatus, MemberDetails, Permissions } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { defaultOptions } from 'formidable';
import { promises as fs } from 'fs';
import type { IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { MockInstance } from 'vitest';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { JudicialRecordService } from '../../../services/judicial-record/JudicialRecordService.js';
import { SessionService } from '../../../services/SessionService.js';
import { DeliverMemberJudicialRecordEndpoint, judicialRecordMemberLimiter, judicialRecordUserLimiter, MAXIMUM_UPLOAD_SIZE } from './DeliverMemberJudicialRecordEndpoint.js';

const endpoint = new DeliverMemberJudicialRecordEndpoint();

/**
 * Stands in for the delivered document. Not a real extract: a valid one has to be signed by FOD
 * Justitie with their private key, and it holds someone's name, birth date and address - so none is
 * committed. What the checks make of a document is the check package's own test, and what the
 * service does around them is the service's; this endpoint only has to hand the bytes over
 * unchanged.
 */
const PDF = new TextEncoder().encode('Dit is geen pdf.');

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

    /**
     * The service is the layer under this one and has its own tests, including which outcome becomes
     * which status and which of them throws. What is left to cover here is that the endpoint asks it
     * for this member with these bytes, and answers and fails with whatever it says.
     */
    let deliver: MockInstance<typeof JudicialRecordService.deliver>;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        // The limiters are process wide, so a test would otherwise inherit the attempts of the one before it
        resetLimiter(judicialRecordMemberLimiter);
        resetLimiter(judicialRecordUserLimiter);

        uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'judicial-record-test-'));
        vi.stubEnv('TMPDIR', uploadDirectory);
        defaultOptions.uploadDir = uploadDirectory;

        deliver = vi.spyOn(JudicialRecordService, 'deliver').mockResolvedValue(JudicialRecordDeliveryStatus.AutoOk);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
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

    /** The multipart request a browser sends: the pdf and nothing else. */
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
                Buffer.from(content ?? PDF),
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

    test('It answers AUTO_OK when the automatic checks settled the delivery', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(response.body.status).toBe(JudicialRecordDeliveryStatus.AutoOk);

        // The document goes over as received, and a month old at most - the same thirty days the member portal counts before it offers to deliver
        expect(deliver).toHaveBeenCalledWith({
            member: expect.objectContaining({ id: member.id }),
            data: Buffer.from(PDF),
            maxAgeInDays: 30,
        });
    });

    test('It answers MANUAL when a reviewer has to open the document', async () => {
        const { organization, token, member } = await setup();
        deliver.mockResolvedValue(JudicialRecordDeliveryStatus.Manual);

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(response.body.status).toBe(JudicialRecordDeliveryStatus.Manual);
    });

    test('It passes on that this member has no extract to deliver', async () => {
        const { organization, token, member } = await setup();
        deliver.mockRejectedValue(new SimpleError({
            code: 'judicial_record_not_required',
            message: 'No judicial record extract is required for this member',
            human: 'Er is geen uittreksel nodig.',
            statusCode: 400,
        }));

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'judicial_record_not_required' }));
    });

    test('It passes on a revoked certificate, the one refusal of a delivery', async () => {
        const { organization, token, member } = await setup();
        deliver.mockRejectedValue(new SimpleError({
            code: 'certificate_revoked',
            message: 'A certificate in the chain is revoked',
            human: 'Vraag een nieuw uittreksel aan bij FOD Justitie.',
            statusCode: 400,
        }));

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'certificate_revoked' }));
    });

    test('It removes the delivered document, also when the delivery was refused', async () => {
        const { organization, token, member } = await setup();
        deliver.mockRejectedValue(new Error('Anything at all'));

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow('Anything at all');

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

        expect(deliver).not.toHaveBeenCalled();
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

        expect(deliver).not.toHaveBeenCalled();
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

        expect(deliver).not.toHaveBeenCalled();
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

        expect(deliver).not.toHaveBeenCalled();
    });

    test('It limits the number of deliveries for one member', async () => {
        const { organization, token, member } = await setup();

        judicialRecordMemberLimiter.track(member.id, 10);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'too_many_requests' }));

        expect(deliver).not.toHaveBeenCalled();
    });

    test('It limits the number of deliveries from one account, over all its members', async () => {
        const { organization, token, user, member } = await setup();

        judicialRecordUserLimiter.track(user.id, 30);

        await expect(testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }))).rejects.toThrow(STExpect.simpleError({ code: 'too_many_requests' }));

        expect(deliver).not.toHaveBeenCalled();
    });
});
