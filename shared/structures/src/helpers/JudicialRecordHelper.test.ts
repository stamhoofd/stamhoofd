import { MemberResponsibility } from '../MemberResponsibility.js';
import { Organization } from '../Organization.js';
import { OrganizationPrivateMetaData } from '../OrganizationPrivateMetaData.js';
import { Platform, PlatformConfig } from '../Platform.js';
import type { JudicialRecordResponsibility } from './JudicialRecordHelper.js';
import { JudicialRecordHelper, JudicialRecordStatus } from './JudicialRecordHelper.js';

describe('JudicialRecordHelper.getStatus', () => {
    const atDate = new Date(2026, 5, 15);
    const birthDay = new Date(2000, 2, 10); // turns 20 on 2020-03-10, 30 on 2030-03-10
    const firstName = 'Nora';

    function createResponsibility(options: Partial<JudicialRecordResponsibility> = {}): JudicialRecordResponsibility {
        return {
            startDate: new Date(2024, 0, 1),
            endDate: null,
            minimumAge: 20,
            ...options,
        };
    }

    test('not required when no responsibility asks for an extract', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ minimumAge: null })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe('Geen enkele functie van {name} vraagt een uittreksel uit het strafregister.');
    });

    test('not required without any responsibility', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe('{name} heeft geen functies.');
    });

    test('a member that only has responsibilities they no longer hold has no functions', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ endDate: new Date(2025, 0, 1) })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe('{name} heeft geen functies.');
    });

    test('required since the start of the responsibility for a member that already reached the age', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2024, 0, 1) })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.Required);
        expect(judicialRecord.description).toBe('Sinds {date}, de startdatum van de functie.');
    });

    test('required since the birthday for a member that was too young when the responsibility started', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2015, 0, 1) })],
            atDate,
        });

        // The responsibility started before the 20th birthday (2020-03-10), so that birthday decides
        expect(judicialRecord.status).toBe(JudicialRecordStatus.Required);
        expect(judicialRecord.description).toBe('Sinds {date}, de {ordinal} verjaardag van {name}.');
    });

    test('a member that is too young is not required yet, and the reason names the birthday', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ minimumAge: 30 })],
            atDate,
        });

        expect(judicialRecord.status).toBe(JudicialRecordStatus.NotRequired);
        expect(judicialRecord.description).toBe('Vanaf {date}, de {ordinal} verjaardag van {name}.');
    });

    test('the earliest date of all responsibilities decides', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
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
        expect(judicialRecord.description).toBe('Vanaf {date}, de {ordinal} verjaardag van {name}.');
    });

    test('a responsibility that already requires an extract wins from one that only will later', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
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

        expect(JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities,
            atDate: new Date(2030, 2, 9),
        }).status).toBe(JudicialRecordStatus.NotRequired);

        expect(JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities,
            atDate: new Date(2030, 2, 10),
        }).status).toBe(JudicialRecordStatus.Required);
    });

    test('responsibilities that are not held are ignored', () => {
        expect(JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ endDate: new Date(2025, 0, 1) })],
            atDate,
        }).status).toBe(JudicialRecordStatus.NotRequired);

        expect(JudicialRecordHelper.getStatus({
            firstName,
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2027, 0, 1) })],
            atDate,
        }).status).toBe(JudicialRecordStatus.NotRequired);
    });

    test('a member without a birth day is treated as an adult', () => {
        const judicialRecord = JudicialRecordHelper.getStatus({
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

    function createPlatform(responsibilities: MemberResponsibility[]) {
        return Platform.create({
            config: PlatformConfig.create({ responsibilities }),
        });
    }

    function createOrganization(responsibilities: MemberResponsibility[]) {
        return Organization.create({
            privateMeta: OrganizationPrivateMetaData.create({ responsibilities }),
        });
    }

    test('false when no responsibility asks for an extract', () => {
        expect(JudicialRecordHelper.asksForExtract({
            platform: createPlatform([createResponsibility(null)]),
            organization: createOrganization([createResponsibility(null)]),
        })).toBe(false);
    });

    test('true when a platform responsibility asks for an extract', () => {
        expect(JudicialRecordHelper.asksForExtract({
            platform: createPlatform([createResponsibility(18)]),
            organization: createOrganization([createResponsibility(null)]),
        })).toBe(true);
    });

    test('true when a responsibility of the organization asks for an extract', () => {
        expect(JudicialRecordHelper.asksForExtract({
            platform: createPlatform([createResponsibility(null)]),
            organization: createOrganization([createResponsibility(18)]),
        })).toBe(true);
    });

    test('the responsibilities of the organization are optional', () => {
        expect(JudicialRecordHelper.asksForExtract({
            platform: createPlatform([createResponsibility(18)]),
        })).toBe(true);

        expect(JudicialRecordHelper.asksForExtract({
            platform: createPlatform([]),
            organization: null,
        })).toBe(false);

        expect(JudicialRecordHelper.asksForExtract({
            platform: createPlatform([]),
            organization: Organization.create({}),
        })).toBe(false);
    });
});
