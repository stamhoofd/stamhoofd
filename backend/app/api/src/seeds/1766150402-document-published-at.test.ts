import { DocumentTemplate, DocumentTemplateFactory } from '@stamhoofd/models';
import { SQL } from '@stamhoofd/sql';
import { DocumentStatus } from '@stamhoofd/structures';
import { initPublishedAtForPublishedDocuments } from './1766150402-document-published-at.js';

describe('migration.document-published-at', () => {
    it('should init published at for published documents', async () => {
        // arrange
        // published documents
        const document1 = await createDocument(DocumentStatus.Published, new Date(2022, 0, 1));
        const document2 = await createDocument(DocumentStatus.Published, new Date(2023, 5, 17));
        const document3 = await createDocument(DocumentStatus.Published, new Date(2025, 3, 9));

        // draft documents
        const document4 = await createDocument(DocumentStatus.Draft, new Date(2022, 0, 1));
        const document5 = await createDocument(DocumentStatus.Draft, new Date(2023, 5, 17));
        const document6 = await createDocument(DocumentStatus.Draft, new Date(2025, 3, 9));

        // reset published at (save does not update published at automatically)
        await SQL.update(DocumentTemplate.table).set('publishedAt', null).where('id', [document1.id, document2.id, document3.id, document4.id, document5.id, document6.id]).update();

        // act
        await initPublishedAtForPublishedDocuments();

        // assert
        const updatedDocument1 = await DocumentTemplate.getByID(document1.id);
        const updatedDocument2 = await DocumentTemplate.getByID(document2.id);
        const updatedDocument3 = await DocumentTemplate.getByID(document3.id);

        const updatedDocument4 = await DocumentTemplate.getByID(document4.id);
        const updatedDocument5 = await DocumentTemplate.getByID(document5.id);
        const updatedDocument6 = await DocumentTemplate.getByID(document6.id);

        expect(updatedDocument1?.publishedAt?.getTime()).toEqual(document1.createdAt.getTime());
        expect(updatedDocument2?.publishedAt?.getTime()).toEqual(document2.createdAt.getTime());
        expect(updatedDocument3?.publishedAt?.getTime()).toEqual(document3.createdAt.getTime());

        expect(updatedDocument4?.publishedAt).toBeNull();
        expect(updatedDocument5?.publishedAt).toBeNull();
        expect(updatedDocument6?.publishedAt).toBeNull();
    });
});

async function createDocument(status: DocumentStatus, createdAt: Date) {
    return await new DocumentTemplateFactory({ groups: [], status, createdAt }).create();
};
