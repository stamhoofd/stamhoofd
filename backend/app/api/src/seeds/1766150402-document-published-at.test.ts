import { DocumentTemplate, DocumentTemplateFactory } from '@stamhoofd/models';
import { DocumentStatus } from '@stamhoofd/structures';
import { initPublishedAtForPublishedDocuments } from './1766150402-document-published-at.js';

describe('migration.document-published-at', () => {
    it('should init published at for published documents', async () => {
        // arrange
        // published documents
        const document1 = await createDocument(DocumentStatus.Published, new Date(2022, 0, 1));
        const document2 = await createDocument(DocumentStatus.Published, new Date(2023, 5, 17));
        const document3 = await createDocument(DocumentStatus.Published, new Date(2025, 3, 9));

        // missing data documents
        const document4 = await createDocument(DocumentStatus.MissingData, new Date(2022, 0, 1));
        const document5 = await createDocument(DocumentStatus.MissingData, new Date(2023, 5, 17));
        const document6 = await createDocument(DocumentStatus.MissingData, new Date(2025, 3, 9));

        // draft documents
        const document7 = await createDocument(DocumentStatus.Draft, new Date(2022, 0, 1));
        const document8 = await createDocument(DocumentStatus.Draft, new Date(2023, 5, 17));
        const document9 = await createDocument(DocumentStatus.Draft, new Date(2025, 3, 9));

        // act
        await initPublishedAtForPublishedDocuments();

        // assert
        const updatedDocument1 = await DocumentTemplate.getByID(document1.id);
        const updatedDocument2 = await DocumentTemplate.getByID(document2.id);
        const updatedDocument3 = await DocumentTemplate.getByID(document3.id);
        const updatedDocument4 = await DocumentTemplate.getByID(document4.id);
        const updatedDocument5 = await DocumentTemplate.getByID(document5.id);
        const updatedDocument6 = await DocumentTemplate.getByID(document6.id);
        const updatedDocument7 = await DocumentTemplate.getByID(document7.id);
        const updatedDocument8 = await DocumentTemplate.getByID(document8.id);
        const updatedDocument9 = await DocumentTemplate.getByID(document9.id);

        expect(updatedDocument1?.publishedAt?.getTime()).toEqual(document1.createdAt.getTime());
        expect(updatedDocument2?.publishedAt?.getTime()).toEqual(document2.createdAt.getTime());
        expect(updatedDocument3?.publishedAt?.getTime()).toEqual(document3.createdAt.getTime());

        expect(updatedDocument4?.publishedAt?.getTime()).toEqual(document4.createdAt.getTime());
        expect(updatedDocument5?.publishedAt?.getTime()).toEqual(document5.createdAt.getTime());
        expect(updatedDocument6?.publishedAt?.getTime()).toEqual(document6.createdAt.getTime());

        expect(updatedDocument7?.publishedAt).toBeNull();
        expect(updatedDocument8?.publishedAt).toBeNull();
        expect(updatedDocument9?.publishedAt).toBeNull();
    });
});

async function createDocument(status: DocumentStatus, createdAt: Date) {
    return await new DocumentTemplateFactory({ groups: [], status, createdAt }).create();
};
