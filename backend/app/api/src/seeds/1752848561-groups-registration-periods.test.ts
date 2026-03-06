import { GroupFactory, OrganizationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { checkShouldSetCustomDates } from './1752848561-groups-registration-periods.js';

describe('migration.groupsRegistrationPeriods', () => {
    describe('checkShouldSetCustomDate', () => {
        const cases: { group: { startDate: Date; endDate: Date }; period: { startDate: Date; endDate: Date }; expected: boolean }[] = [
            // case 1
            {
                group: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                },
                period: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                },
                expected: false,
            },
            // case 2
            {
                group: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                },
                period: {
                    startDate: new Date(2023, 0, 29),
                    endDate: new Date(2023, 11, 31),
                },
                expected: false,
            },
            // case 3
            {
                group: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                },
                period: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2024, 0, 28),
                },
                expected: false,
            },
            // case 4
            {
                group: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                },
                period: {
                    startDate: new Date(2023, 1, 1),
                    endDate: new Date(2023, 11, 31),
                },
                expected: true,
            },
            // case 5
            {
                group: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 11, 31),
                },
                period: {
                    startDate: new Date(2023, 0, 1),
                    endDate: new Date(2023, 10, 30),
                },
                expected: true,
            },
        ];

        cases.forEach((testCase, index) => {
            it(`Case ${index + 1}`, async () => {
                // arrange
                const period = await new RegistrationPeriodFactory(testCase.period).create();
                const organization = await new OrganizationFactory({ period }).create();
                period.organizationId = organization.id;
                await period.save();
                const group = await new GroupFactory({ organization, period }).create();
                group.settings.startDate = testCase.group.startDate;
                group.settings.endDate = testCase.group.endDate;
                await group.save();

                // act
                const result = checkShouldSetCustomDates(group, period);
                expect(result).toBe(testCase.expected);
            });
        });
    });
});
