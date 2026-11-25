import { SimpleError, isSimpleError } from '@common/errors';
import type { Member, Organization } from '@stamhoofd/models';
import {
    Image,
    JudicialRecord,
    MemberFactory,
    MemberResponsibilityRecordFactory,
    OrganizationFactory,
    Platform,
    PlatformResponsibilityFactory,
} from '@stamhoofd/models';
import {
    JUDICIAL_RECORD_MAX_COMMENT_LENGTH,
    JudicialRecordCheck,
    JudicialRecordCheckReport,
    JudicialRecordCheckResult,
    JudicialRecordCheckStatus,
    JudicialRecordFileRemovedReason,
    JudicialRecordReviewDecision,
    JudicialRecordStatus,
    judicialRecordChecksInOrder,
    judicialRecordFeatureFlag,
    MemberResponsibility,
} from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { JUDICIAL_RECORD_MAX_AGE_IN_DAYS, JudicialRecordService } from './JudicialRecordService.js';

const checkJudicialRecordMock = vi.hoisted(() => vi.fn());
const assertChainNotRevokedMock = vi.hoisted(() => vi.fn());

vi.mock('@stamhoofd/judicial-record-check', () => ({
    checkJudicialRecord: checkJudicialRecordMock,
}));

vi.mock('@stamhoofd/certificate-revocation', () => ({
    assertChainNotRevoked: assertChainNotRevokedMock,
}));

/** A real signed extract holds someone's name, birth date and address, so one is never committed. */
const PDF = new TextEncoder().encode('Dit is geen pdf.');

/** Stands in for the chain the signature validated, which only reaches the revocation call. */
const CERTIFICATE_PATH = [{ signer: true }];

function report(
    statuses: Partial<Record<JudicialRecordCheck, JudicialRecordCheckStatus>> = {},
): JudicialRecordCheckReport {
    return JudicialRecordCheckReport.create({
        checks: judicialRecordChecksInOrder.map((check) =>
            JudicialRecordCheckResult.create({
                check,
                status: statuses[check] ?? JudicialRecordCheckStatus.Passed,
                reason: 'Een reden.',
            }),
        ),
    });
}

/**
 * Stands in for the bucket. Keyed by object key, so a test can assert that the document is actually gone and
 * not merely unreferenced - which is the whole promise the review flow makes to the member.
 */
function useFakeBucket(): Map<string, Uint8Array> {
    const objects = new Map<string, Uint8Array>();

    beforeEach(() => {
        TestUtils.setEnvironment('SPACES_BUCKET', 'test-bucket');
        TestUtils.setEnvironment('SPACES_ENDPOINT', 'test.digitaloceanspaces.com');
        TestUtils.setEnvironment('SPACES_KEY', 'test-key');
        TestUtils.setEnvironment('SPACES_SECRET', 'test-secret');

        objects.clear();

        Image.s3Client = {
            send: (command: {
                constructor: { name: string };
                input: { Key: string; Body?: Uint8Array };
            }) => {
                const key = command.input.Key;

                switch (command.constructor.name) {
                    case 'PutObjectCommand':
                        objects.set(key, command.input.Body!);
                        return Promise.resolve({});

                    case 'GetObjectCommand': {
                        const body = objects.get(key);
                        if (body === undefined) {
                            return Promise.reject(new Error('NoSuchKey ' + key));
                        }
                        return Promise.resolve({
                            Body: { transformToByteArray: () => Promise.resolve(body) },
                        });
                    }

                    case 'DeleteObjectCommand':
                        objects.delete(key);
                        return Promise.resolve({});

                    default:
                        return Promise.reject(
                            new Error('Unexpected command ' + command.constructor.name),
                        );
                }
            },
        } as any;
    });

    afterEach(() => {
        Image.s3Client = null;
    });

    return objects;
}

async function currentRecord(member: Member): Promise<JudicialRecord | null> {
    const records = await JudicialRecord.select().where('memberId', member.id).fetch();
    return records[0] ?? null;
}

describe('JudicialRecordService.deliver', () => {
    const objects = useFakeBucket();

    let organization: Organization;
    let responsibility: MemberResponsibility;
    let organizationResponsibility: MemberResponsibility;
    let originalResponsibilities: MemberResponsibility[];
    let originalFeatureFlags: string[];

    /** Holds a responsibility that asks for an extract, and is old enough for it to apply. */
    let member: Member;

    let memberWithoutResponsibility: Member;

    /** Holds a responsibility the organization defined itself, not a platform one. */
    let memberWithOrganizationResponsibility: Member;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();

        const platform = await Platform.getForEditing();
        originalResponsibilities = platform.config.responsibilities;
        originalFeatureFlags = platform.config.featureFlags;

        platform.config.featureFlags = [...originalFeatureFlags, judicialRecordFeatureFlag];
        await platform.save();
        await Platform.clearCache();

        responsibility = await new PlatformResponsibilityFactory({
            name: 'Judicial record needed',
            judicialRecordMinimumAge: 18,
        }).create();
        await Platform.clearCache();

        // Defined by the organization itself, so it lives in its privateMeta and not in the platform config
        organizationResponsibility = MemberResponsibility.create({
            name: 'Organization judicial record needed',
            organizationBased: true,
            judicialRecordMinimumAge: 18,
        });
        organization.privateMeta.responsibilities.push(organizationResponsibility);
        await organization.save();

        member = await new MemberFactory({
            organization,
            birthDay: { year: 1990, month: 1, day: 1 },
        }).create();
        memberWithoutResponsibility = await new MemberFactory({
            organization,
            birthDay: { year: 1990, month: 1, day: 1 },
        }).create();
        memberWithOrganizationResponsibility = await new MemberFactory({
            organization,
            birthDay: { year: 1990, month: 1, day: 1 },
        }).create();

        await new MemberResponsibilityRecordFactory({
            member,
            organizationId: organization.id,
            responsibility,
            startDate: new Date(2020, 0, 1),
        }).create();

        await new MemberResponsibilityRecordFactory({
            member: memberWithOrganizationResponsibility,
            organizationId: organization.id,
            responsibility: organizationResponsibility,
            startDate: new Date(2020, 0, 1),
        }).create();
    });

    afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.config.responsibilities = originalResponsibilities;
        platform.config.featureFlags = originalFeatureFlags;
        await platform.save();
        await Platform.clearCache();
    });

    beforeEach(() => {
        checkJudicialRecordMock.mockReset();
        assertChainNotRevokedMock.mockReset();
        assertChainNotRevokedMock.mockResolvedValue(undefined);
    });

    function deliver(options: { member?: Member } = {}) {
        return JudicialRecordService.deliver(options.member ?? member, PDF);
    }

    async function setPlatformFeatureFlags(featureFlags: string[]) {
        const platform = await Platform.getForEditing();
        platform.config.featureFlags = featureFlags;
        await platform.save();
        await Platform.clearCache();
    }

    test('refuses a member no responsibility asks an extract of, without reading the document', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });

        const error = await deliver({ member: memberWithoutResponsibility }).then(
            () => null,
            (error: unknown) => error,
        );

        expect(isSimpleError(error) && error.code).toBe('judicial_record_not_required');
        expect(checkJudicialRecordMock).not.toHaveBeenCalled();
    });

    test('refuses a delivery while the feature flag is off, without reading the document', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });

        await setPlatformFeatureFlags([]);

        try {
            const error = await deliver().then(
                () => null,
                (error: unknown) => error,
            );

            expect(isSimpleError(error) && error.code).toBe('judicial_record_feature_disabled');
            expect(checkJudicialRecordMock).not.toHaveBeenCalled();
        } finally {
            await setPlatformFeatureFlags([...originalFeatureFlags, judicialRecordFeatureFlag]);
        }
    });

    test('accepts a delivery an organization turned the feature on for, with the platform flag off', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });

        await setPlatformFeatureFlags([]);
        organization.privateMeta.featureFlags.push(judicialRecordFeatureFlag);
        await organization.save();

        try {
            expect(await deliver()).toBe(JudicialRecordStatus.Ok);
        } finally {
            organization.privateMeta.featureFlags = organization.privateMeta.featureFlags.filter(
                (flag) => flag !== judicialRecordFeatureFlag,
            );
            await organization.save();
            await setPlatformFeatureFlags([...originalFeatureFlags, judicialRecordFeatureFlag]);
        }
    });

    test('answers Ok when every check passed', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });

        expect(await deliver()).toBe(JudicialRecordStatus.Ok);

        expect(checkJudicialRecordMock).toHaveBeenCalledWith({
            data: PDF,
            firstName: member.details.firstName,
            lastName: member.details.lastName,
            birthDay: member.details.birthDay,
            maxAgeInDays: JUDICIAL_RECORD_MAX_AGE_IN_DAYS,
        });
        expect(assertChainNotRevokedMock).toHaveBeenCalledWith(CERTIFICATE_PATH);
    });

    test('refuses a delivery whose certificate chain is revoked', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });
        assertChainNotRevokedMock.mockRejectedValue(
            new SimpleError({
                code: 'certificate_revoked',
                message: 'A certificate in the chain is revoked',
                human: 'Vraag een nieuw uittreksel aan bij FOD Justitie.',
                statusCode: 400,
            }),
        );

        const error = await deliver().then(
            () => null,
            (error: unknown) => error,
        );

        expect(isSimpleError(error) && error.code).toBe('certificate_revoked');
    });

    /** Regression test for the organization in scope that used to be a parameter of `deliver`. */
    test('finds a requirement an organization defined itself, with no organization in scope', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });

        expect(await deliver({ member: memberWithOrganizationResponsibility })).toBe(
            JudicialRecordStatus.Ok,
        );
    });

    test('answers UnderReview on a failed content check', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report({ [JudicialRecordCheck.EmptyRecord]: JudicialRecordCheckStatus.Failed }),
            certificatePath: CERTIFICATE_PATH,
        });

        expect(await deliver()).toBe(JudicialRecordStatus.UnderReview);
    });

    test('keeps no document for an extract the checks approved, and dates the approval', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report(),
            certificatePath: CERTIFICATE_PATH,
        });

        await deliver();

        const record = await currentRecord(member);

        expect(record?.reviewDecision).toBe(JudicialRecordReviewDecision.Ok);
        expect(record?.file).toBeNull();

        // Expiry runs from this date, so an automatic approval without one would never expire
        expect(record?.reviewedAt).not.toBeNull();
        expect(objects.size).toBe(0);
    });

    test('keeps the document of an extract a reviewer has to look at', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report({ [JudicialRecordCheck.EmptyRecord]: JudicialRecordCheckStatus.Failed }),
            certificatePath: CERTIFICATE_PATH,
        });

        await deliver();

        const record = await currentRecord(member);

        expect(record?.reviewDecision).toBe(JudicialRecordReviewDecision.UnderReview);
        expect(record?.reviewedAt).toBeNull();
        expect(record?.reviewDetails).toBeNull();
        expect(objects.get(record!.file!.reference!)).toEqual(PDF);
    });

    test('replaces the previous delivery and gets rid of the document nobody will review now', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report({ [JudicialRecordCheck.EmptyRecord]: JudicialRecordCheckStatus.Failed }),
            certificatePath: CERTIFICATE_PATH,
        });

        await deliver();
        const first = await currentRecord(member);

        await deliver();
        const second = await currentRecord(member);

        expect(second?.id).not.toBe(first?.id);
        expect(objects.has(first!.file!.reference!)).toBe(false);
        expect(objects.has(second!.file!.reference!)).toBe(true);

        // One record per member, so the one before it is gone rather than kept as history
        expect(await JudicialRecord.getByID(first!.id)).toBeUndefined();
    });

    test('answers UnderReview on a failed Authentic check, rather than refusing the delivery', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report({
                [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Failed,
                [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Pending,
                [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Pending,
                [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending,
                [JudicialRecordCheck.EmptyRecord]: JudicialRecordCheckStatus.Pending,
            }),
            certificatePath: null,
        });

        expect(await deliver()).toBe(JudicialRecordStatus.UnderReview);

        // There is no chain to ask about when the signature did not hold
        expect(assertChainNotRevokedMock).not.toHaveBeenCalled();
    });
});

describe('JudicialRecordService.review', () => {
    const objects = useFakeBucket();

    let organization: Organization;
    let responsibility: MemberResponsibility;
    let originalResponsibilities: MemberResponsibility[];
    let originalFeatureFlags: string[];
    let member: Member;

    const reviewer = {
        id: 'user-1',
        name: 'Simon',
        email: 'simon@example.com',
        organizationId: null,
    };

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();

        const platform = await Platform.getForEditing();
        originalResponsibilities = platform.config.responsibilities;
        originalFeatureFlags = platform.config.featureFlags;

        // Delivering is what puts a document in front of a reviewer, and that asks for the feature flag
        platform.config.featureFlags = [...originalFeatureFlags, judicialRecordFeatureFlag];
        await platform.save();
        await Platform.clearCache();

        responsibility = await new PlatformResponsibilityFactory({
            name: 'Review needed',
            judicialRecordMinimumAge: 18,
        }).create();
        await Platform.clearCache();

        member = await new MemberFactory({
            organization,
            birthDay: { year: 1990, month: 1, day: 1 },
        }).create();

        await new MemberResponsibilityRecordFactory({
            member,
            organizationId: organization.id,
            responsibility,
            startDate: new Date(2020, 0, 1),
        }).create();
    });

    afterAll(async () => {
        const platform = await Platform.getForEditing();
        platform.config.responsibilities = originalResponsibilities;
        platform.config.featureFlags = originalFeatureFlags;
        await platform.save();
        await Platform.clearCache();
    });

    /** Delivers an extract the checks could not approve, which is the only kind a reviewer ever sees. */
    async function deliverForReview(): Promise<JudicialRecord> {
        checkJudicialRecordMock.mockReset();
        assertChainNotRevokedMock.mockReset();
        assertChainNotRevokedMock.mockResolvedValue(undefined);
        checkJudicialRecordMock.mockResolvedValue({
            report: report({ [JudicialRecordCheck.EmptyRecord]: JudicialRecordCheckStatus.Failed }),
            certificatePath: CERTIFICATE_PATH,
        });

        await JudicialRecordService.deliver(member, PDF);

        return (await currentRecord(member))!;
    }

    function review(options: { outcome: JudicialRecordReviewDecision; comment?: string | null }) {
        return JudicialRecordService.review({
            member,
            outcome: options.outcome,
            comment: options.comment ?? null,
            reviewer,
        });
    }

    test('records the decision, who took it, and deletes the document', async () => {
        const delivered = await deliverForReview();
        const reference = delivered.file!.reference!;

        await review({
            outcome: JudicialRecordReviewDecision.TemporarilyRejected,
            comment: '  Niet leesbaar.  ',
        });

        const record = await currentRecord(member);

        expect(record?.reviewDecision).toBe(JudicialRecordReviewDecision.TemporarilyRejected);
        expect(record?.reviewedAt).not.toBeNull();
        expect(record?.reviewDetails?.userId).toBe(reviewer.id);
        expect(record?.reviewDetails?.name).toBe(reviewer.name);
        expect(record?.reviewDetails?.email).toBe(reviewer.email);
        expect(record?.reviewDetails?.comment).toBe('Niet leesbaar.');

        expect(record?.file?.reference).toBeNull();
        expect(record?.file?.removedReason).toBe(JudicialRecordFileRemovedReason.Reviewed);

        // The promise to the member is about the document, not about the reference to it
        expect(objects.has(reference)).toBe(false);
    });

    test('lets a conditional acceptance through once its conditions are written down', async () => {
        await deliverForReview();

        await review({
            outcome: JudicialRecordReviewDecision.ConditionallyAccepted,
            comment: 'Nooit alleen met een groep.',
        });

        const record = await currentRecord(member);

        expect(record?.reviewDecision).toBe(JudicialRecordReviewDecision.ConditionallyAccepted);
        expect(record?.reviewDetails?.comment).toBe('Nooit alleen met een groep.');
    });

    test('refuses a conditional acceptance without conditions, and keeps the document', async () => {
        const delivered = await deliverForReview();

        const error = await review({
            outcome: JudicialRecordReviewDecision.ConditionallyAccepted,
        }).then(
            () => null,
            (error: unknown) => error,
        );

        expect(isSimpleError(error) && error.field).toBe('comment');
        expect(objects.has(delivered.file!.reference!)).toBe(true);
        expect((await currentRecord(member))?.reviewDecision).toBe(
            JudicialRecordReviewDecision.UnderReview,
        );
    });

    test('refuses UnderReview, which is the absence of a decision rather than one', async () => {
        const delivered = await deliverForReview();

        const error = await review({ outcome: JudicialRecordReviewDecision.UnderReview }).then(
            () => null,
            (error: unknown) => error,
        );

        expect(isSimpleError(error) && error.field).toBe('reviewDecision');
        expect(objects.has(delivered.file!.reference!)).toBe(true);
    });

    test('refuses a comment longer than the limit', async () => {
        await deliverForReview();

        const error = await review({
            outcome: JudicialRecordReviewDecision.Ok,
            comment: 'a'.repeat(JUDICIAL_RECORD_MAX_COMMENT_LENGTH + 1),
        }).then(
            () => null,
            (error: unknown) => error,
        );

        expect(isSimpleError(error) && error.field).toBe('comment');
    });

    test('refuses to review a member who delivered nothing', async () => {
        const other = await new MemberFactory({
            organization,
            birthDay: { year: 1990, month: 1, day: 1 },
        }).create();

        const error = await JudicialRecordService.review({
            member: other,
            outcome: JudicialRecordReviewDecision.Ok,
            comment: null,
            reviewer,
        }).then(
            () => null,
            (error: unknown) => error,
        );

        expect(isSimpleError(error) && error.code).toBe('judicial_record_not_found');
    });
});
