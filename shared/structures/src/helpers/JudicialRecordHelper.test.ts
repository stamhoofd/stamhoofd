import { MemberResponsibility } from '../MemberResponsibility.js';
import { Organization } from '../Organization.js';
import { OrganizationPrivateMetaData } from '../OrganizationPrivateMetaData.js';
import { Platform, PlatformConfig } from '../Platform.js';
import { JudicialRecordReviewDecision } from '../members/JudicialRecordReview.js';
import type { JudicialRecordCurrentRecord, JudicialRecordResponsibility } from './JudicialRecordHelper.js';
import { JUDICIAL_RECORD_VALIDITY_YEARS, JudicialRecordHelper, JudicialRecordStatus } from './JudicialRecordHelper.js';
import { judicialRecordFeatureFlag } from './judicialRecordFeature.js';

describe('JudicialRecordHelper.getForMember', () => {
    const atDate = new Date(2026, 5, 15);
    const birthDay = new Date(2000, 2, 10); // turns 20 on 2020-03-10, 30 on 2030-03-10
    const firstName = 'Nora';

    function createResponsibility(
        options: Partial<JudicialRecordResponsibility> = {},
    ): JudicialRecordResponsibility {
        return {
            startDate: new Date(2024, 0, 1),
            endDate: null,
            minimumAge: 20,
            ...options,
        };
    }

    test('not required when no responsibility asks for an extract', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ minimumAge: null })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe(
            'Geen enkele functie van {name} vraagt een uittreksel uit het strafregister.',
        );
    });

    test('not required without any responsibility', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe('{name} heeft geen functies.');
    });

    test('a member that only has responsibilities they no longer hold has no functions', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ endDate: new Date(2025, 0, 1) })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe('{name} heeft geen functies.');
    });

    test('required since the start of the responsibility for a member that already reached the age', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2024, 0, 1) })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.Required);
        expect(judicialRecord.description).toBe('Sinds {date}, de startdatum van de functie.');
    });

    test('required since the birthday for a member that was too young when the responsibility started', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2015, 0, 1) })],
            atDate,
        });

        // The responsibility started before the 20th birthday (2020-03-10), so that birthday decides
        expect(judicialRecord.status).toBe(JudicialRecordStatus.Required);
        expect(judicialRecord.description).toBe(
            'Sinds {date}, de {ordinal} verjaardag van {name}.',
        );
    });

    test('a member that is too young is not required yet, and the reason names the birthday', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ minimumAge: 30 })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe(
            'Vanaf {date}, de {ordinal} verjaardag van {name}.',
        );
    });

    test('the earliest date of all responsibilities decides', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [
                createResponsibility({ minimumAge: 40 }),
                createResponsibility({ minimumAge: 30 }),
                createResponsibility({ minimumAge: null }),
            ],
            atDate,
        });

        // The 30th birthday (2030-03-10) comes before the 40th, and both are still in the future
        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe(
            'Vanaf {date}, de {ordinal} verjaardag van {name}.',
        );
    });

    test('a responsibility that already requires an extract wins from one that only will later', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay,
            responsibilities: [
                createResponsibility({ minimumAge: 30 }),
                createResponsibility({ minimumAge: 20 }),
            ],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.Required);
        expect(judicialRecord.description).toBe('Sinds {date}, de startdatum van de functie.');
    });

    test('required from the day the member reaches the age', () => {
        const responsibilities = [createResponsibility({ minimumAge: 30 })];

        expect(
            JudicialRecordHelper.getForMember({
                firstName,
                birthDay,
                responsibilities,
                atDate: new Date(2030, 2, 9),
            }).status,
        ).toBe(JudicialRecordStatus.NotRequired);

        expect(
            JudicialRecordHelper.getForMember({
                firstName,
                birthDay,
                responsibilities,
                atDate: new Date(2030, 2, 10),
            }).status,
        ).toBe(JudicialRecordStatus.Required);
    });

    test('responsibilities that are not held are ignored', () => {
        expect(
            JudicialRecordHelper.getForMember({
                firstName,
                birthDay,
                responsibilities: [createResponsibility({ endDate: new Date(2025, 0, 1) })],
                atDate,
            }).status,
        ).toBe(JudicialRecordStatus.NotRequired);

        expect(
            JudicialRecordHelper.getForMember({
                firstName,
                birthDay,
                responsibilities: [createResponsibility({ startDate: new Date(2027, 0, 1) })],
                atDate,
            }).status,
        ).toBe(JudicialRecordStatus.NotRequired);
    });

    test('a member without a birth day is treated as an adult', () => {
        const judicialRecord = JudicialRecordHelper.getForMember({
            firstName,
            birthDay: null,
            responsibilities: [createResponsibility({ startDate: new Date(2024, 0, 1) })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.Required);
        expect(judicialRecord.description).toBe('Sinds {date}, de startdatum van de functie.');
    });
});

describe('JudicialRecordHelper.asksForExtract', () => {
    function createResponsibility(judicialRecordMinimumAge: number | null) {
        return MemberResponsibility.create({
            name: 'Leiding',
            judicialRecordMinimumAge,
        });
    }

    function createPlatform(
        responsibilities: MemberResponsibility[],
        featureFlags: string[] = [judicialRecordFeatureFlag],
    ) {
        return Platform.create({
            config: PlatformConfig.create({ responsibilities, featureFlags }),
        });
    }

    function createOrganization(
        responsibilities: MemberResponsibility[],
        featureFlags: string[] = [],
    ) {
        return Organization.create({
            privateMeta: OrganizationPrivateMetaData.create({ responsibilities, featureFlags }),
        });
    }

    test('false when no responsibility asks for an extract', () => {
        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([createResponsibility(null)]),
                organization: createOrganization([createResponsibility(null)]),
            }),
        ).toBe(false);
    });

    test('true when a platform responsibility asks for an extract', () => {
        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([createResponsibility(18)]),
                organization: createOrganization([createResponsibility(null)]),
            }),
        ).toBe(true);
    });

    test('true when a responsibility of the organization asks for an extract', () => {
        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([createResponsibility(null)]),
                organization: createOrganization([createResponsibility(18)]),
            }),
        ).toBe(true);
    });

    test('the responsibilities of the organization are optional', () => {
        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([createResponsibility(18)]),
            }),
        ).toBe(true);

        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([]),
                organization: null,
            }),
        ).toBe(false);

        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([]),
                organization: Organization.create({}),
            }),
        ).toBe(false);
    });

    test('false while the feature flag is off, however the responsibilities are configured', () => {
        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([createResponsibility(18)], []),
                organization: createOrganization([createResponsibility(18)]),
            }),
        ).toBe(false);
    });

    test('an organization can turn the feature on for itself', () => {
        expect(
            JudicialRecordHelper.asksForExtract({
                platform: createPlatform([createResponsibility(18)], []),
                organization: createOrganization(
                    [createResponsibility(null)],
                    [judicialRecordFeatureFlag],
                ),
            }),
        ).toBe(true);
    });
});

describe('JudicialRecordHelper.getStoredStatus', () => {
    const atDate = new Date(2026, 5, 15);

    function record(reviewDecision: JudicialRecordReviewDecision, options: { reviewedAt?: Date | null } = {}): JudicialRecordCurrentRecord {
        return {
            reviewDecision,
            reviewedAt: options.reviewedAt === undefined ? new Date(2026, 0, 1) : options.reviewedAt,
        };
    }

    /** Every review outcome, and the status it gives the member: one for one, nothing collapsed. */
    const mapping: [JudicialRecordReviewDecision, JudicialRecordStatus][] = [
        [JudicialRecordReviewDecision.UnderReview, JudicialRecordStatus.UnderReview],
        [JudicialRecordReviewDecision.Ok, JudicialRecordStatus.Ok],
        [JudicialRecordReviewDecision.ConditionallyAccepted, JudicialRecordStatus.ConditionallyAccepted],
        [JudicialRecordReviewDecision.TemporarilyRejected, JudicialRecordStatus.TemporarilyRejected],
        [JudicialRecordReviewDecision.PermanentlyRejected, JudicialRecordStatus.PermanentlyRejected],
    ];

    test.each(mapping)('%s gives the member %s', (reviewDecision, expected) => {
        expect(JudicialRecordHelper.getStoredStatus(record(reviewDecision), atDate)).toBe(expected);
    });

    test('a conditional acceptance permits, but is not an unconditional one', () => {
        const status = JudicialRecordHelper.getStoredStatus(record(JudicialRecordReviewDecision.ConditionallyAccepted), atDate);

        expect(status).toBe(JudicialRecordStatus.ConditionallyAccepted);
        expect(status).not.toBe(JudicialRecordStatus.Ok);
    });

    test('an approval older than the validity window decides nothing', () => {
        const expired = new Date(atDate);
        expired.setFullYear(expired.getFullYear() - JUDICIAL_RECORD_VALIDITY_YEARS);
        expired.setDate(expired.getDate() - 1);

        expect(JudicialRecordHelper.getStoredStatus(record(JudicialRecordReviewDecision.Ok, { reviewedAt: expired }), atDate)).toBeNull();
    });

    test('a temporary rejection does not expire, because it already asks for a new extract', () => {
        const longAgo = new Date(2000, 0, 1);

        expect(JudicialRecordHelper.getStoredStatus(record(JudicialRecordReviewDecision.TemporarilyRejected, { reviewedAt: longAgo }), atDate))
            .toBe(JudicialRecordStatus.TemporarilyRejected);
    });

    test('an unreviewed record cannot expire', () => {
        expect(JudicialRecordHelper.hasExpired(null, atDate)).toBe(false);
    });

    test('only NotRequired, Ok and ConditionallyAccepted let a member act', () => {
        const permitted = Object.values(JudicialRecordStatus).filter(status =>
            status === JudicialRecordStatus.NotRequired
            || status === JudicialRecordStatus.Ok
            || status === JudicialRecordStatus.ConditionallyAccepted,
        );

        expect(permitted).toHaveLength(3);
        expect(Object.values(JudicialRecordStatus)).toHaveLength(7);
    });
});
