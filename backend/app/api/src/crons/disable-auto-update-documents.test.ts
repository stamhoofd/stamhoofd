import { DocumentTemplate, DocumentTemplateFactory } from '@stamhoofd/models';
import { DocumentStatus } from '@stamhoofd/structures';
import { disableAutoUpdateForFiscalDocuments, disableAutoUpdateForOtherDocuments } from './disable-auto-update-documents.js';

describe('cron.disable-auto-update-documents', () => {
    describe('disableAutoUpdateForFiscalDocuments', () => {
        it('should only run on the 1st of March', async () => {
            // arrange
            const firstOfMarch2025 = new Date(2025, 2, 1);

            const cases: { now: Date; expected: boolean }[] = [
                { now: new Date(firstOfMarch2025.getTime() - 1), expected: false },
                { now: new Date(firstOfMarch2025), expected: true },
                { now: new Date(2025, 2, 2), expected: false },
                { now: new Date(new Date(2026, 2, 1)), expected: true },
            ];

            for (const { now, expected } of cases) {
                // act
                const result = await disableAutoUpdateForFiscalDocuments(now);
                // assert
                expect(result).toBe(expected);
            }
        });

        it('should disable auto-update for fiscal documents of the previous year', async () => {
            // // arrange
            const firstOfMarch2025 = new Date(2025, 2, 1);

            const document1 = await createDocument({
                status: DocumentStatus.Published,
                publishedAt: new Date(2025, 0, 1),
                createdAt: new Date(2024, 11, 15),
                year: 2024,
                type: 'fiscal',
                updatesEnabled: true,
            });

            // old year
            const document2 = await createDocument({
                status: DocumentStatus.Published,
                publishedAt: new Date(2025, 0, 1),
                createdAt: new Date(2024, 11, 15),
                year: 2023,
                type: 'fiscal',
                updatesEnabled: true,
            });

            // current year
            const document3 = await createDocument({
                status: DocumentStatus.Published,
                publishedAt: new Date(2025, 0, 1),
                createdAt: new Date(2024, 11, 15),
                year: 2025,
                type: 'fiscal',
                updatesEnabled: true,
            });

            // type participation
            const document4 = await createDocument({
                status: DocumentStatus.Published,
                publishedAt: new Date(2025, 0, 1),
                createdAt: new Date(2024, 11, 15),
                year: 2024,
                type: 'participation',
                updatesEnabled: true,
            });

            // act
            const didRun = await disableAutoUpdateForFiscalDocuments(firstOfMarch2025);

            // assert
            const updatedDocument1 = (await DocumentTemplate.getByID(document1.id))!;
            const updatedDocument2 = (await DocumentTemplate.getByID(document2.id))!;
            const updatedDocument3 = (await DocumentTemplate.getByID(document3.id))!;
            const updatedDocument4 = (await DocumentTemplate.getByID(document4.id))!;

            expect(didRun).toBe(true);

            // should update because previous year, type is fiscal and updates enabled
            expect(updatedDocument1.updatesEnabled).toBe(false);
            // should not update because not previous year
            expect(updatedDocument2.updatesEnabled).toBe(true);
            // should not update because not previous year
            expect(updatedDocument3.updatesEnabled).toBe(true);
            // should not update because type is not fiscal
            expect(updatedDocument4.updatesEnabled).toBe(true);
        });
    });

    describe('disableAutoUpdateForOtherDocuments', () => {
        it('should disable auto-update for documents, other than fiscal documents, that have been published 90 days ago', async () => {
            // // arrange
            const today = new Date(2025, 5, 15);
            const ninetyDaysAgo = new Date(2025, 2, 17);

            const cases: { document: DocumentTemplate; expected: boolean }[] = [
                // should update because 90 days ago and type is not fiscal
                {
                    document: await createDocument({
                        status: DocumentStatus.Published,
                        publishedAt: new Date(ninetyDaysAgo),
                        createdAt: new Date(2024, 11, 15),
                        year: 2024,
                        type: 'participation',
                        updatesEnabled: true,
                    }),
                    expected: false,
                },
                // day after
                {
                    document: await createDocument({
                        status: DocumentStatus.Published,
                        publishedAt: new Date(2025, 2, 18),
                        createdAt: new Date(2024, 11, 15),
                        year: 2024,
                        type: 'participation',
                        updatesEnabled: true,
                    }),
                    expected: true,
                },
                // day before
                {
                    document: await createDocument({
                        status: DocumentStatus.Published,
                        publishedAt: new Date(ninetyDaysAgo.getTime() - 1),
                        createdAt: new Date(2024, 11, 15),
                        year: 2024,
                        type: 'participation',
                        updatesEnabled: true,
                    }),
                    expected: true,
                },
                // type fiscal
                {
                    document: await createDocument({
                        status: DocumentStatus.Published,
                        publishedAt: new Date(ninetyDaysAgo),
                        createdAt: new Date(2024, 11, 15),
                        year: 2024,
                        type: 'fiscal',
                        updatesEnabled: true,
                    }),
                    expected: true,
                },
            ];

            // act
            await disableAutoUpdateForOtherDocuments(today);

            // assert
            for (const { document, expected } of cases) {
                const updatedDocument = (await DocumentTemplate.getByID(document.id))!;
                expect(updatedDocument.updatesEnabled).toBe(expected);
            }
        });
    });
});

async function createDocument({ year, status, createdAt, updatesEnabled, type, publishedAt }: { year: number; status: DocumentStatus; createdAt: Date; updatesEnabled: boolean; type: 'fiscal' | 'participation'; publishedAt: Date | null }) {
    const document = await new DocumentTemplateFactory({ year, groups: [], status, updatesEnabled, publishedAt, createdAt, type }).create();

    return document;
};
