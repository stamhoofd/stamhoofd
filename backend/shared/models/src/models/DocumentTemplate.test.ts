import { DocumentStatus } from '@stamhoofd/structures';
import { DocumentTemplateFactory } from '../factories/DocumentTemplateFactory.js';

describe('Model.DocumentTemplate', () => {
    it('PublishedAt should be set if status is published and publishedAt is null', async () => {
        const documentTemplate = await new DocumentTemplateFactory({
            status: DocumentStatus.Published,
            groups: [],
        }).create();

        expect(documentTemplate.publishedAt).not.toBeNull();
    });

    it('PublishedAt should not change if status is published and publishedAt is already set', async () => {
        const documentTemplate = await new DocumentTemplateFactory({
            status: DocumentStatus.Published,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        expect(documentTemplate.publishedAt?.getTime()).toBe(new Date(2025, 5, 1).getTime());
    });

    it('PublishedAt should be set to null if status is draft', async () => {
        const documentTemplate = await new DocumentTemplateFactory({
            status: DocumentStatus.Draft,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        expect(documentTemplate.publishedAt).toBeNull();
    });

    // should probably never happen
    it('PublishedAt should be not change if status is not draft or published', async () => {
        const documentTemplate1 = await new DocumentTemplateFactory({
            status: DocumentStatus.Deleted,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        const documentTemplate2 = await new DocumentTemplateFactory({
            status: DocumentStatus.Deleted,
            publishedAt: null,
            groups: [],
        }).create();

        const documentTemplate3 = await new DocumentTemplateFactory({
            status: DocumentStatus.MissingData,
            publishedAt: new Date(2025, 5, 1),
            groups: [],
        }).create();

        const documentTemplate4 = await new DocumentTemplateFactory({
            status: DocumentStatus.MissingData,
            publishedAt: null,
            groups: [],
        }).create();

        expect(documentTemplate1.publishedAt?.getTime()).toBe(new Date(2025, 5, 1).getTime());
        expect(documentTemplate2.publishedAt).toBeNull();
        expect(documentTemplate3.publishedAt?.getTime()).toBe(new Date(2025, 5, 1).getTime());
        expect(documentTemplate4.publishedAt).toBeNull();
    });
});
