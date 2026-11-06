import { SimpleError, isSimpleError } from '@common/errors';
import type { Member, Organization } from '@stamhoofd/models';
import { MemberFactory, MemberResponsibilityRecordFactory, OrganizationFactory, Platform, PlatformResponsibilityFactory } from '@stamhoofd/models';
import { JudicialRecordCheck, JudicialRecordCheckReport, JudicialRecordCheckResult, JudicialRecordCheckStatus, JudicialRecordDeliveryStatus, judicialRecordChecksInOrder, MemberResponsibility } from '@stamhoofd/structures';
import { JudicialRecordService } from './JudicialRecordService.js';

const checkJudicialRecordMock = vi.hoisted(() => vi.fn());
const assertChainNotRevokedMock = vi.hoisted(() => vi.fn());

vi.mock('@stamhoofd/judicial-record-check', () => ({
    checkJudicialRecord: checkJudicialRecordMock,
}));

vi.mock('@stamhoofd/certificate-revocation', () => ({
    assertChainNotRevoked: assertChainNotRevokedMock,
}));

/**
 * Only passed on to the mocked package, which decides nothing about it: a real signed extract holds
 * someone's name, birth date and address, so one is never committed. What the five checks make of a
 * document is `@stamhoofd/judicial-record-check`'s own test; this covers what the service does
 * around them.
 */
const PDF = new TextEncoder().encode('Dit is geen pdf.');

/** Stands in for the chain the signature validated, which only reaches the revocation call. */
const CERTIFICATE_PATH = [{ signer: true }];

const MAX_AGE_IN_DAYS = 31;

/** Every check passed unless a test says otherwise, since that is the one outcome with two steps. */
function report(statuses: Partial<Record<JudicialRecordCheck, JudicialRecordCheckStatus>> = {}): JudicialRecordCheckReport {
    return JudicialRecordCheckReport.create({
        checks: judicialRecordChecksInOrder.map(check => JudicialRecordCheckResult.create({
            check,
            status: statuses[check] ?? JudicialRecordCheckStatus.Passed,
            reason: 'Een reden.',
        })),
    });
}

describe('JudicialRecordService.deliver', () => {
    let organization: Organization;
    let responsibility: MemberResponsibility;
    let organizationResponsibility: MemberResponsibility;
    let originalResponsibilities: MemberResponsibility[];

    /** Holds a responsibility that asks for an extract, and is old enough for it to apply. */
    let member: Member;

    /** Holds nothing, so no responsibility of theirs asks for an extract. */
    let memberWithoutResponsibility: Member;

    /** Holds a responsibility the organization defined itself, not a platform one. */
    let memberWithOrganizationResponsibility: Member;

    beforeAll(async () => {
        organization = await new OrganizationFactory({}).create();

        const platform = await Platform.getForEditing();
        originalResponsibilities = platform.config.responsibilities;

        responsibility = await new PlatformResponsibilityFactory({ name: 'Judicial record needed', judicialRecordMinimumAge: 18 }).create();
        await Platform.clearCache();

        // Defined by the organization itself, so it lives in its privateMeta and not in the platform config
        organizationResponsibility = MemberResponsibility.create({
            name: 'Organization judicial record needed',
            organizationBased: true,
            judicialRecordMinimumAge: 18,
        });
        organization.privateMeta.responsibilities.push(organizationResponsibility);
        await organization.save();

        member = await new MemberFactory({ organization, birthDay: { year: 1990, month: 1, day: 1 } }).create();
        memberWithoutResponsibility = await new MemberFactory({ organization, birthDay: { year: 1990, month: 1, day: 1 } }).create();
        memberWithOrganizationResponsibility = await new MemberFactory({ organization, birthDay: { year: 1990, month: 1, day: 1 } }).create();

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
        await platform.save();
        await Platform.clearCache();
    });

    beforeEach(() => {
        checkJudicialRecordMock.mockReset();
        assertChainNotRevokedMock.mockReset();
        assertChainNotRevokedMock.mockResolvedValue(undefined);
    });

    function deliver(options: { member?: Member } = {}) {
        return JudicialRecordService.deliver({
            member: options.member ?? member,
            data: PDF,
            maxAgeInDays: MAX_AGE_IN_DAYS,
        });
    }

    test('refuses a member no responsibility asks an extract of, without reading the document', async () => {
        checkJudicialRecordMock.mockResolvedValue({ report: report(), certificatePath: CERTIFICATE_PATH });

        const error = await deliver({ member: memberWithoutResponsibility }).then(() => null, (error: unknown) => error);

        expect(isSimpleError(error) && error.code).toBe('judicial_record_not_required');
        expect(checkJudicialRecordMock).not.toHaveBeenCalled();
    });

    test('answers AUTO_OK when every check passed', async () => {
        checkJudicialRecordMock.mockResolvedValue({ report: report(), certificatePath: CERTIFICATE_PATH });

        expect(await deliver()).toBe(JudicialRecordDeliveryStatus.AutoOk);

        expect(checkJudicialRecordMock).toHaveBeenCalledWith({
            data: PDF,
            firstName: member.details.firstName,
            lastName: member.details.lastName,
            birthDay: member.details.birthDay,
            maxAgeInDays: MAX_AGE_IN_DAYS,
        });
        expect(assertChainNotRevokedMock).toHaveBeenCalledWith(CERTIFICATE_PATH);
    });

    test('refuses a delivery whose certificate chain is revoked', async () => {
        checkJudicialRecordMock.mockResolvedValue({ report: report(), certificatePath: CERTIFICATE_PATH });
        assertChainNotRevokedMock.mockRejectedValue(new SimpleError({
            code: 'certificate_revoked',
            message: 'A certificate in the chain is revoked',
            human: 'Vraag een nieuw uittreksel aan bij FOD Justitie.',
            statusCode: 400,
        }));

        const error = await deliver().then(() => null, (error: unknown) => error);

        expect(isSimpleError(error) && error.code).toBe('certificate_revoked');
    });

    /**
     * The regression test for the organization in scope that used to be a parameter here. An extract
     * is delivered from the member portal, which on a platform is in no organization at all, so a
     * requirement an organization defined itself has to be found through the member's own records -
     * otherwise this member is told they do not have to deliver, while they do.
     */
    test('finds a requirement an organization defined itself, with no organization in scope', async () => {
        checkJudicialRecordMock.mockResolvedValue({ report: report(), certificatePath: CERTIFICATE_PATH });

        expect(await deliver({ member: memberWithOrganizationResponsibility })).toBe(JudicialRecordDeliveryStatus.AutoOk);
    });

    test('answers MANUAL on a failed content check', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report({ [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Failed }),
            certificatePath: CERTIFICATE_PATH,
        });

        expect(await deliver()).toBe(JudicialRecordDeliveryStatus.Manual);
    });

    /**
     * The rule most likely to be undone later. The member saw this failure in the step before
     * delivering and chose to deliver anyway - an extract from another country our checks cannot
     * read reaches this same case - so a reviewer opens the document rather than the backend
     * refusing something the member was already told about.
     */
    test('answers MANUAL on a failed Authentic check, rather than refusing the delivery', async () => {
        checkJudicialRecordMock.mockResolvedValue({
            report: report({
                [JudicialRecordCheck.Authentic]: JudicialRecordCheckStatus.Failed,
                [JudicialRecordCheck.Identity]: JudicialRecordCheckStatus.Pending,
                [JudicialRecordCheck.Model]: JudicialRecordCheckStatus.Pending,
                [JudicialRecordCheck.Age]: JudicialRecordCheckStatus.Pending,
                [JudicialRecordCheck.Blank]: JudicialRecordCheckStatus.Pending,
            }),
            certificatePath: null,
        });

        expect(await deliver()).toBe(JudicialRecordDeliveryStatus.Manual);

        // There is no chain to ask about when the signature did not hold
        expect(assertChainNotRevokedMock).not.toHaveBeenCalled();
    });
});
