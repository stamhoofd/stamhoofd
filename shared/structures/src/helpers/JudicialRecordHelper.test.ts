import type { JudicialRecordResponsibility } from './JudicialRecordHelper.js';
import { JudicialRecordHelper, JudicialRecordStatus } from './JudicialRecordHelper.js';

describe('JudicialRecordHelper.getRequirement', () => {
    const atDate = new Date(2026, 5, 15);
    const birthDay = new Date(2000, 2, 10); // turns 20 on 2020-03-10, 30 on 2030-03-10

    function createResponsibility(options: Partial<JudicialRecordResponsibility> = {}): JudicialRecordResponsibility {
        return {
            startDate: new Date(2024, 0, 1),
            endDate: null,
            minimumAge: 20,
            ...options,
        };
    }

    test('not required when no responsibility asks for an extract', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [createResponsibility({ minimumAge: null })],
            atDate,
        });

        expect(requirement.status).toBe(JudicialRecordStatus.NotRequired);
        expect(requirement.description).toBe('Geen enkele functie van dit lid vraagt een uittreksel uit het strafregister.');
    });

    test('not required without any responsibility', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [],
            atDate,
        });

        expect(requirement.status).toBe(JudicialRecordStatus.NotRequired);
    });

    test('required since the start of the responsibility for a member that already reached the age', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2024, 0, 1) })],
            atDate,
        });

        expect(requirement.status).toBe(JudicialRecordStatus.Required);
        expect(requirement.description).toBe('Vereist sinds {date}');
    });

    test('a member that is too young is not required yet, and the reason names the birthday', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [createResponsibility({ minimumAge: 30 })],
            atDate,
        });

        expect(requirement.status).toBe(JudicialRecordStatus.NotRequired);
        expect(requirement.description).toBe('Vereist vanaf {date} ({ordinal} verjaardag)');
    });

    test('the earliest date of all responsibilities decides', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [
                createResponsibility({ minimumAge: 40 }),
                createResponsibility({ minimumAge: 30 }),
                createResponsibility({ minimumAge: null }),
            ],
            atDate,
        });

        // The 30th birthday (2030-03-10) comes before the 40th, and both are still in the future
        expect(requirement.status).toBe(JudicialRecordStatus.NotRequired);
        expect(requirement.description).toBe('Vereist vanaf {date} ({ordinal} verjaardag)');
    });

    test('a responsibility that already requires an extract wins from one that only will later', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [
                createResponsibility({ minimumAge: 30 }),
                createResponsibility({ minimumAge: 20 }),
            ],
            atDate,
        });

        expect(requirement.status).toBe(JudicialRecordStatus.Required);
        expect(requirement.description).toBe('Vereist sinds {date}');
    });

    test('required from the day the member reaches the age', () => {
        const responsibilities = [createResponsibility({ minimumAge: 30 })];

        expect(JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities,
            atDate: new Date(2030, 2, 9),
        }).status).toBe(JudicialRecordStatus.NotRequired);

        expect(JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities,
            atDate: new Date(2030, 2, 10),
        }).status).toBe(JudicialRecordStatus.Required);
    });

    test('responsibilities that are not held are ignored', () => {
        expect(JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [createResponsibility({ endDate: new Date(2025, 0, 1) })],
            atDate,
        }).status).toBe(JudicialRecordStatus.NotRequired);

        expect(JudicialRecordHelper.getRequirement({
            birthDay,
            responsibilities: [createResponsibility({ startDate: new Date(2027, 0, 1) })],
            atDate,
        }).status).toBe(JudicialRecordStatus.NotRequired);
    });

    test('a member without a birth day is treated as an adult', () => {
        const requirement = JudicialRecordHelper.getRequirement({
            birthDay: null,
            responsibilities: [createResponsibility({ startDate: new Date(2024, 0, 1) })],
            atDate,
        });

        expect(requirement.status).toBe(JudicialRecordStatus.Required);
        expect(requirement.description).toBe('Vereist sinds {date}');
    });
});
