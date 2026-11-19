import { column } from '@node/database';
import { DocumentData, DocumentStatus, Document as DocumentStruct } from '@stamhoofd/structures';
import type { BelcotaxDocumentStatus } from '@stamhoofd/structures/belcotax/BelcotaxSubmission.js';
import { v4 as uuidv4 } from 'uuid';

import { SimpleError } from '@common/errors';
import { QueryableModel } from '@stamhoofd/sql';

export class Document extends QueryableModel {
    static table = 'documents';

    @column({
        primary: true,
        type: 'string',
        beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    templateId: string;

    /**
     * Used to give a member access to the document
     */
    @column({ type: 'string', nullable: true })
    memberId: string | null = null;

    /**
     * Used to identify document already created for a registration (= to update it)
     */
    @column({ type: 'string', nullable: true })
    registrationId: string | null = null;

    /**
     * Set when the certificate of a registration is split between multiple debtors: the id of the parent this document is issued to
     */
    @column({ type: 'string', nullable: true })
    parentId: string | null = null;

    @column({ type: 'string' })
    status = DocumentStatus.Draft;

    @column({ type: 'boolean' })
    isLocked = false;

    /**
     * Assigned when exporting the document
     */
    @column({ type: 'integer', nullable: true })
    number: number | null = null;

    /**
     * Settings of the document. This information is public
     */
    @column({ type: 'json', decoder: DocumentData })
    data = DocumentData.create({});

    /**
     * Result of the last submission to the Belcotax API with this document. Only changed with a query (not save),
     * so it is no edit of the document and also works for locked documents.
     */
    @column({ type: 'string', nullable: true })
    belcotaxStatus: BelcotaxDocumentStatus | null = null;

    /**
     * Hash of the lines of the version Belcotax accepted: the fiche with its persons and resources, or the delete
     * line. Belcotax has no version of the document when null.
     */
    @column({ type: 'string', nullable: true })
    belcotaxHash: string | null = null;

    @column({ type: 'datetime' })
    createdAt: Date = new Date();

    @column({
        type: 'datetime',
        beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    override save(
        options?: Parameters<QueryableModel['save']>[0] & { forceSave?: boolean },
    ): Promise<boolean> {
        if (!options?.forceSave && this.isLocked) {
            throw new SimpleError({
                code: 'locked',
                message: 'Document is locked',
                human: $t('%1Uc'),
            });
        }

        return super.save(options);
    }

    getStructure() {
        return DocumentStruct.create(this);
    }
}
