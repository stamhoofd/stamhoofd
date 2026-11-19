import { Request } from '@node/endpoints';
import { Image, JudicialRecord, MemberFactory, OrganizationFactory, UserFactory } from '@stamhoofd/models';
import { JudicialRecordReviewDecision, MemberDetails, Permissions } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { PermissionLevel } from '@stamhoofd/types/PermissionLevel';
import { testServer } from '../../../../tests/helpers/TestServer.js';
import { SessionService } from '../../../services/SessionService.js';
import { GetMemberJudicialRecordDocumentEndpoint } from './GetMemberJudicialRecordDocumentEndpoint.js';
import { ReviewMemberJudicialRecordEndpoint } from './ReviewMemberJudicialRecordEndpoint.js';

const reviewEndpoint = new ReviewMemberJudicialRecordEndpoint();
const documentEndpoint = new GetMemberJudicialRecordDocumentEndpoint();

/** A real extract holds someone's name, birth date and address, so one is never committed. */
const PDF = new TextEncoder().encode('Dit is geen pdf.');

describe('Endpoint.ReviewMemberJudicialRecord', () => {
    let objects: Map<string, Uint8Array>;

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        TestUtils.setEnvironment('SPACES_BUCKET', 'test-bucket');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'test.digitaloceanspaces.com');
        TestUtils.setEnvironment('SPACES_KEY', 'test-key');
        TestUtils.setEnvironment('SPACES_SECRET', 'test-secret');

        objects = new Map();

        Image.s3Client = {
            send: (command: { constructor: { name: string }; input: { Key: string; Body?: Uint8Array } }) => {
                const key = command.input.Key;

                switch (command.constructor.name) {
                    case 'PutObjectCommand':
                        objects.set(key, command.input.Body!);
                        return Promise.resolve({});

                    case 'GetObjectCommand': {
                        const body = objects.get(key);
                        return body === undefined
                            ? Promise.reject(new Error('NoSuchKey'))
                            : Promise.resolve({ Body: { transformToByteArray: () => Promise.resolve(body) } });
                    }

                    case 'DeleteObjectCommand':
                        objects.delete(key);
                        return Promise.resolve({});

                    default:
                        return Promise.reject(new Error('Unexpected command'));
                }
            },
        } as any;
    });

    afterEach(() => {
        Image.s3Client = null;
    });

    /**
     * A member with an extract waiting for a reviewer. The row is written here rather than by delivering one,
     * because what this endpoint does with a record does not depend on how the record got there.
     */
    async function setup() {
        const organization = await new OrganizationFactory({}).create();

        const member = await new MemberFactory({
            organization,
            details: MemberDetails.create({
                firstName: 'Jan',
                lastName: 'Janssens',
                birthDay: new Date(Date.UTC(1990, 3, 5)),
            }),
        }).create();

        const key = 'judicial-records/' + member.id + '/document.pdf';
        objects.set(key, PDF);

        const record = new JudicialRecord();
        record.memberId = member.id;
        record.reviewDecision = JudicialRecordReviewDecision.UnderReview;
        record.identityHash = member.judicialIdentityHash!;
        record.file = { reference: key, removedAt: null, removedReason: null } as never;
        await record.save();

        return { organization, member, record, key };
    }

    async function createReviewer(organization: Awaited<ReturnType<typeof setup>>['organization']) {
        const user = await new UserFactory({
            organization,
            globalPermissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        return { user, token: (await SessionService.createSession(user)).accessToken };
    }

    function reviewRequest({ token, host, memberId, body }: { token: string; host: string; memberId: string; body: unknown }) {
        const request = Request.buildJson('POST', `/v1/members/${memberId}/judicial-record/review`, host, body);
        request.headers.authorization = 'Bearer ' + token;
        return request;
    }

    test('a reviewer records an outcome, and the document is gone afterwards', async () => {
        const { organization, member, key } = await setup();
        const { token, user } = await createReviewer(organization);

        await testServer.test(reviewEndpoint, reviewRequest({
            token,
            host: organization.getApiHost(),
            memberId: member.id,
            body: { reviewDecision: JudicialRecordReviewDecision.PermanentlyRejected, comment: 'Niet in orde.' },
        }));

        const records = await JudicialRecord.select().where('memberId', member.id).fetch();

        expect(records[0].reviewDecision).toBe(JudicialRecordReviewDecision.PermanentlyRejected);
        expect(records[0].reviewDetails?.userId).toBe(user.id);
        expect(records[0].reviewDetails?.comment).toBe('Niet in orde.');
        expect(objects.has(key)).toBe(false);
    });

    /**
     * In organization mode there is no second organization for a review to bind, so the right is one a full
     * administrator of the organization holds. Platform mode still refuses them, which the structures tests pin.
     */
    test('a full administrator reviews their own member in organization mode', async () => {
        const { organization, member } = await setup();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = (await SessionService.createSession(user)).accessToken;

        await testServer.test(reviewEndpoint, reviewRequest({
            token,
            host: organization.getApiHost(),
            memberId: member.id,
            body: { reviewDecision: JudicialRecordReviewDecision.Ok, comment: null },
        }));

        const records = await JudicialRecord.select().where('memberId', member.id).fetch();

        expect(records[0].reviewDecision).toBe(JudicialRecordReviewDecision.Ok);
        expect(records[0].reviewDetails?.userId).toBe(user.id);
    });

    test('a full administrator reads the document in organization mode', async () => {
        const { organization, member } = await setup();

        const user = await new UserFactory({
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = (await SessionService.createSession(user)).accessToken;

        const request = Request.buildJson('GET', `/v1/members/${member.id}/judicial-record/document`, organization.getApiHost(), undefined);
        request.headers.authorization = 'Bearer ' + token;

        const response = await testServer.test(documentEndpoint, request);

        expect(response.status).toBe(200);
    });

    /** Holding the right is not enough: the reviewer still has to be able to read the member. */
    test('an administrator of another organization is refused', async () => {
        const { member } = await setup();

        const other = await new OrganizationFactory({}).create();
        const user = await new UserFactory({
            organization: other,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();
        const token = (await SessionService.createSession(user)).accessToken;

        await expect(testServer.test(reviewEndpoint, reviewRequest({
            token,
            host: other.getApiHost(),
            memberId: member.id,
            body: { reviewDecision: JudicialRecordReviewDecision.Ok, comment: null },
        }))).rejects.toThrow(STExpect.errorWithCode('not_found'));
    });


    test('a reviewer reads the document, and it is not served as a pdf', async () => {
        const { organization, member } = await setup();
        const { token } = await createReviewer(organization);

        const request = Request.buildJson('GET', `/v1/members/${member.id}/judicial-record/document`, organization.getApiHost(), undefined);
        request.headers.authorization = 'Bearer ' + token;

        const response = await testServer.test(documentEndpoint, request);

        expect(new Uint8Array(response.body as Buffer)).toEqual(PDF);

        // Nothing that came from outside is ever rendered on the api origin
        expect(response.headers['content-type']).toBe('application/octet-stream');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    test('the document is no longer readable once a decision was recorded', async () => {
        const { organization, member } = await setup();
        const { token } = await createReviewer(organization);

        await testServer.test(reviewEndpoint, reviewRequest({
            token,
            host: organization.getApiHost(),
            memberId: member.id,
            body: { reviewDecision: JudicialRecordReviewDecision.Ok, comment: null },
        }));

        const request = Request.buildJson('GET', `/v1/members/${member.id}/judicial-record/document`, organization.getApiHost(), undefined);
        request.headers.authorization = 'Bearer ' + token;

        await expect(testServer.test(documentEndpoint, request)).rejects.toThrow(STExpect.errorWithCode('judicial_record_document_removed'));
    });
});
