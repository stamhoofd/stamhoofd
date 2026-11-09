import { SimpleError } from '@common/errors';
import { Request } from '@node/endpoints';
import type { RateLimiter } from '@stamhoofd/models';
import { MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { JudicialRecordStatus, MemberDetails, Permissions } from '@stamhoofd/structures';
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
 * Not a real extract: a valid one is signed by FOD Justitie with their private key and holds
 * someone's name, birth date and address, so none is committed. This endpoint only has to hand the
 * bytes over unchanged.
 */
const PDF = new TextEncoder().encode('Dit is geen pdf.');

function resetLimiter(limiter: RateLimiter) {
    for (const window of limiter.windows) {
        window.windows.clear();
        window.start = new Date();
    }
}

describe('Endpoint.DeliverMemberJudicialRecord', () => {
    /** Both the directory the endpoint allocates and formidable's own default, so what is left behind after a test is visible. */
    let uploadDirectory: string;
    const originalUploadDirectory = defaultOptions.uploadDir;

    let deliver: MockInstance<typeof JudicialRecordService.deliver>;

    beforeEach(async () => {
        TestUtils.setEnvironment('userMode', 'organization');

        // The limiters are process wide, so a test would otherwise inherit the attempts of the one before it
        resetLimiter(judicialRecordMemberLimiter);
        resetLimiter(judicialRecordUserLimiter);

        uploadDirectory = await fs.mkdtemp(join(tmpdir(), 'judicial-record-test-'));
        vi.stubEnv('TMPDIR', uploadDirectory);
        defaultOptions.uploadDir = uploadDirectory;

        deliver = vi.spyOn(JudicialRecordService, 'deliver').mockResolvedValue(JudicialRecordStatus.Ok);
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

    function buildUpload({ token, organizationHost, memberId, contentType, body }: {
        token: string;
        organizationHost: string;
        memberId: string;
        contentType?: string;
        body: Buffer;
    }) {
        const stream = Readable.from([body]) as unknown as IncomingMessage;
        stream.headers = {
            'content-length': body.length.toString(),
        };

        if (contentType !== undefined) {
            stream.headers['content-type'] = contentType;
        }

        const request = Request.buildJson('POST', `/v1/members/${memberId}/judicial-record`, organizationHost);
        request.headers.authorization = 'Bearer ' + token;
        request.request = stream;

        return request;
    }

    /** The multipart request a browser sends: the pdf and nothing else. */
    function buildRequest({ token, organizationHost, memberId, content, fieldName = 'file' }: {
        token: string;
        organizationHost: string;
        memberId: string;
        content?: Uint8Array;
        fieldName?: string;
    }) {
        const boundary = '--------------------------StamhoofdTest';
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="uittreksel.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
            Buffer.from(content ?? PDF),
            Buffer.from(`\r\n--${boundary}--\r\n`),
        ]);

        return buildUpload({ token, organizationHost, memberId, contentType: `multipart/form-data; boundary=${boundary}`, body });
    }

    test('It answers Ok when the automatic checks settled the delivery', async () => {
        const { organization, token, member } = await setup();

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(response.body.status).toBe(JudicialRecordStatus.Ok);

        // The document goes over as received, and a month old at most - the same thirty days the member portal counts before it offers to deliver
        expect(deliver).toHaveBeenCalledWith({
            member: expect.objectContaining({ id: member.id }),
            data: Buffer.from(PDF),
            maxAgeInDays: 30,
        });
    });

    test('It answers UnderReview when a reviewer has to open the document', async () => {
        const { organization, token, member } = await setup();
        deliver.mockResolvedValue(JudicialRecordStatus.UnderReview);

        const response = await testServer.test(endpoint, buildRequest({
            token: token.accessToken,
            organizationHost: organization.getApiHost(),
            memberId: member.id,
        }));

        expect(response.body.status).toBe(JudicialRecordStatus.UnderReview);
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
        }))).rejects.toThrow(STExpect.simpleError({ code: 'file_too_large', field: 'file', statusCode: 400 }));

        expect(deliver).not.toHaveBeenCalled();
        expect(await fs.readdir(uploadDirectory)).toEqual([]);
    });

    describe('A body that holds no document is the client\'s mistake, never a 500', () => {
        const missingFile = STExpect.simpleError({ code: 'missing_field', field: 'file', statusCode: 400 });

        test('It requires a file part', async () => {
            const { organization, token, member } = await setup();
            const boundary = 'StamhoofdTest';

            await expect(testServer.test(endpoint, buildUpload({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                contentType: `multipart/form-data; boundary=${boundary}`,
                body: Buffer.from(`--${boundary}--\r\n`),
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });

        test('It requires that part to be the one it asked for', async () => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildRequest({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                fieldName: 'document',
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });

        test('It refuses an empty file', async () => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildRequest({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                content: new Uint8Array(0),
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });

        test('It refuses a body that is not multipart', async () => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildUpload({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                contentType: 'application/json',
                body: Buffer.from('{}'),
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });

        test('It refuses a request without a content type', async () => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildUpload({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                body: Buffer.from(''),
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });

        test('It refuses a multipart content type without a boundary', async () => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildUpload({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                contentType: 'multipart/form-data',
                body: Buffer.from('anything'),
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });

        test('It refuses a multipart body that ends mid-parse', async () => {
            const { organization, token, member } = await setup();

            await expect(testServer.test(endpoint, buildUpload({
                token: token.accessToken,
                organizationHost: organization.getApiHost(),
                memberId: member.id,
                contentType: 'multipart/form-data; boundary=StamhoofdTest',
                body: Buffer.from('not multipart at all'),
            }))).rejects.toThrow(missingFile);

            expect(deliver).not.toHaveBeenCalled();
        });
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

        // Full access to the member is not enough: that right arrives with the review flow
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
