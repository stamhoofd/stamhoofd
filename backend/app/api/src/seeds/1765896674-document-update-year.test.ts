import { DocumentTemplate, DocumentTemplateFactory, GroupFactory, OrganizationFactory, RegistrationPeriod, RegistrationPeriodFactory } from '@stamhoofd/models';
import { migrateDocumentYears } from './1765896674-document-update-year.js';

describe('migration.document-update-year', () => {
    describe('should use most frequent year of groups', () => {
        test('groups with date in period', async () => {
            const organization = await new OrganizationFactory({
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date(2021, 0, 1),
                endDate: new Date(2021, 11, 31),
                organization,
            }).create();

            organization.periodId = period1.id;
            await organization.save();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date(2019, 0, 1),
                endDate: new Date(2019, 11, 31),
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
            const group1 = await createGroup(new Date(2021, 0, 1), new Date(2021, 11, 31), period1);
            const group2 = await createGroup(new Date(2021, 0, 1), new Date(2021, 11, 31), period1);
            const group3 = await createGroup(new Date(2019, 0, 1), new Date(2019, 11, 31), period2);

            // document created in 2021
            const document1 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document1.createdAt = new Date(2022, 0, 1);
            await document1.save();

            // document created in 2020
            const document2 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document2.createdAt = new Date(2021, 0, 1);
            await document2.save();

            // document created in 2019
            const document3 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document3.createdAt = new Date(2020, 0, 1);
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
            expect(updatedDocument3?.year).toBe(2021);
        });

        test('groups overlapping period', async () => {
            const organization = await new OrganizationFactory({
            }).create();

            const period1 = await new RegistrationPeriodFactory({
                startDate: new Date(2021, 0, 1),
                endDate: new Date(2021, 11, 31),
                organization,
            }).create();

            organization.periodId = period1.id;
            await organization.save();

            const period2 = await new RegistrationPeriodFactory({
                startDate: new Date(2020, 0, 1),
                endDate: new Date(2020, 11, 31),
                organization,
            }).create();

            const period3 = await new RegistrationPeriodFactory({
                startDate: new Date(2019, 0, 1),
                endDate: new Date(2019, 11, 31),
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
            const group1 = await createGroup(new Date(2020, 6, 1), new Date(2021, 5, 30), period1);
            const group2 = await createGroup(new Date(2020, 7, 5), new Date(2021, 4, 3), period1);
            const group3 = await createGroup(new Date(2018, 5, 1), new Date(2019, 10, 14), period3);

            // document created in 2021
            const document1 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document1.createdAt = new Date(2022, 0, 1);
            await document1.save();

            // document created in 2020
            const document2 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document2.createdAt = new Date(2021, 0, 1);
            await document2.save();

            // document created in 2019
            const document3 = await new DocumentTemplateFactory({
                groups: [group1, group2, group3],
                year: 0,
            }).create();

            document3.createdAt = new Date(2020, 0, 1);
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

        document.createdAt = new Date(2025, 0, 1);
        await document.save();

        // act
        await migrateDocumentYears();

        // assert
        const updatedDocument = await DocumentTemplate.getByID(document.id);

        // year should be year of creation
        expect(updatedDocument?.year).toBe(2024);
    });
});
