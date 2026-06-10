import type { RegistrationPeriod } from '@stamhoofd/models';
import { DocumentTemplate, DocumentTemplateFactory, GroupFactory, OrganizationFactory, RegistrationPeriodFactory } from '@stamhoofd/models';
import { migrateDocumentYears } from './1750090029-document-update-year.js';
import { Formatter } from '@stamhoofd/utility';

describe('migration.document-update-year', () => {
    describe('should use most frequent year of groups', () => {
        test('groups with date in period', async () => {
            const organization = await new OrganizationFactory({
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: Formatter.luxon().set({ day: 1, month: 1, year: 2021 }).toJSDate(),
                endDate: Formatter.luxon().set({ day: 31, month: 12, year: 2021 }).toJSDate(),
                organization,
            }).create();

            organization.periodId = period1.id;
            await organization.save();

            const period2 = await new RegistrationPeriodFactory({
                startDate: Formatter.luxon().set({ day: 1, month: 1, year: 2019 }).toJSDate(),
                endDate: Formatter.luxon().set({ day: 31, month: 12, year: 2019 }).toJSDate(),
                organization,
            }).create();

            const createGroup = async (startDate: Date, endDate: Date, period: RegistrationPeriod) => {
                const group = await new GroupFactory({ organization, period }).create();
                group.settings.startDate = startDate;
                group.settings.endDate = endDate;
                await group.save();
                return group;
            };

            // groups
            const group1 = await createGroup(Formatter.luxon().set({ day: 1, month: 1, year: 2021 }).toJSDate(), Formatter.luxon().set({ day: 31, month: 12, year: 2021 }).toJSDate(), period1);
            const group2 = await createGroup(Formatter.luxon().set({ day: 1, month: 1, year: 2021 }).toJSDate(), Formatter.luxon().set({ day: 31, month: 12, year: 2021 }).toJSDate(), period1);
            const group3 = await createGroup(Formatter.luxon().set({ day: 1, month: 1, year: 2019 }).toJSDate(), Formatter.luxon().set({ day: 31, month: 12, year: 2019 }).toJSDate(), period2);

            // document created in 2021
            const document1 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document1.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2022 }).toJSDate();
            await document1.save();

            // document created in 2020
            const document2 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document2.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2021 }).toJSDate();
            await document2.save();

            // document created in 2019
            const document3 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document3.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2020 }).toJSDate();
            await document3.save();

            // act
            await migrateDocumentYears();

            // assert
            const updatedDocument1 = await DocumentTemplate.getByID(document1.id);
            const updatedDocument2 = await DocumentTemplate.getByID(document2.id);
            const updatedDocument3 = await DocumentTemplate.getByID(document3.id);

            // take most frequent year and prefer date of document creation
            expect(updatedDocument1?.year).toBe(2021);
            expect(updatedDocument2?.year).toBe(2021);
            expect(updatedDocument3?.year).toBe(2020); // maxed at creation year
        });

        test('groups overlapping period', async () => {
            const organization = await new OrganizationFactory({
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: Formatter.luxon().set({ day: 1, month: 1, year: 2021 }).toJSDate(),
                endDate: Formatter.luxon().set({ day: 31, month: 12, year: 2021 }).toJSDate(),
                organization,
            }).create();

            organization.periodId = period1.id;
            await organization.save();

            const period2 = await new RegistrationPeriodFactory({
                startDate: Formatter.luxon().set({ day: 1, month: 1, year: 2020 }).toJSDate(),
                endDate: Formatter.luxon().set({ day: 31, month: 12, year: 2020 }).toJSDate(),
                organization,
            }).create();

            const period3 = await new RegistrationPeriodFactory({
                startDate: Formatter.luxon().set({ day: 1, month: 1, year: 2019 }).toJSDate(),
                endDate: Formatter.luxon().set({ day: 31, month: 12, year: 2019 }).toJSDate(),
                organization,
            }).create();

            const createGroup = async (startDate: Date, endDate: Date, period: RegistrationPeriod) => {
                const group = await new GroupFactory({ organization, period }).create();
                group.settings.startDate = startDate;
                group.settings.endDate = endDate;
                await group.save();
                return group;
            };

            // groups
            const group1 = await createGroup(Formatter.luxon().set({ day: 1, month: 7, year: 2020 }).toJSDate(), Formatter.luxon().set({ day: 30, month: 6, year: 2021 }).toJSDate(), period1);
            const group2 = await createGroup(Formatter.luxon().set({ day: 5, month: 8, year: 2020 }).toJSDate(), Formatter.luxon().set({ day: 3, month: 5, year: 2021 }).toJSDate(), period1);
            const group3 = await createGroup(Formatter.luxon().set({ day: 1, month: 6, year: 2018 }).toJSDate(), Formatter.luxon().set({ day: 14, month: 11, year: 2019 }).toJSDate(), period3);

            // document created in 2021
            const document1 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document1.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2022 }).toJSDate();
            await document1.save();

            // document created in 2020
            const document2 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document2.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2021 }).toJSDate();
            await document2.save();

            // document created in 2019
            const document3 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document3.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2020 }).toJSDate();
            await document3.save();

            // act
            await migrateDocumentYears();

            // assert
            const updatedDocument1 = await DocumentTemplate.getByID(document1.id);
            const updatedDocument2 = await DocumentTemplate.getByID(document2.id);
            const updatedDocument3 = await DocumentTemplate.getByID(document3.id);

            // take most frequent year and prefer date of document creation
            expect(updatedDocument1?.year).toBe(2020);
            // should take 2020 because document was created in 2020
            expect(updatedDocument2?.year).toBe(2020);
            expect(updatedDocument3?.year).toBe(2020);
        });
    });

    test('no groups should use year before creation', async () => {
        // create document
        const document = await new DocumentTemplateFactory({
            groups: [],
            year: 0,
        }).create();

        document.createdAt = Formatter.luxon().set({ day: 1, month: 1, year: 2025 }).toJSDate();
        await document.save();

        // act
        await migrateDocumentYears();

        // assert
        const updatedDocument = await DocumentTemplate.getByID(document.id);

        // year should be year of creation
        expect(updatedDocument?.year).toBe(2024);
    });
});
