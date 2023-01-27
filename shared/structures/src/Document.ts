import { AnyDecoder, ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, MapDecoder,NumberDecoder, RecordDecoder, StringDecoder } from "@simonbackx/simple-encoding"
import { v4 as uuidv4 } from "uuid";

import { RecordAnswer, RecordAnswerDecoder } from "./members/records/RecordAnswer"
import { RecordCategory } from "./members/records/RecordCategory"

export enum DocumentStatus {
    Draft = "Draft",
    MissingData = "MissingData",
    Published = "published",
}
export class DocumentStatusHelper {
    static getName(status: DocumentStatus): string {
        switch (status) {
            case DocumentStatus.Draft: return "Klad"
            case DocumentStatus.MissingData: return "Onvolledig"
            case DocumentStatus.Published: return "Gepubliceerd"
        }
    }

    static getColor(status: DocumentStatus): string {
        switch (status) {
            case DocumentStatus.Draft: return "info"
            case DocumentStatus.MissingData: return "error"
            case DocumentStatus.Published: return "tertiary"
        }
    }
}
export class DocumentSettings extends AutoEncoder {
    @field({ decoder: NumberDecoder, nullable: true })
    maxAge: number | null = null

    /**
     * Fields defined by the template that can be set.
     */
    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder) })
    fieldAnswers: RecordAnswer[] = []

    /**
     * Defines where to automatically find the answer for a given question
     */
    @field({ decoder: new MapDecoder(StringDecoder, StringDecoder) })
    linkedFields: Map<string, string> = new Map()
}

export class DocumentTemplateDefinition extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""

    @field({ decoder: new ArrayDecoder(RecordCategory) })
    fieldCategories: RecordCategory[] = []

    /**
     * Questions filled out for each selected group / cycle combination
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    groupFieldCategories: RecordCategory[] = []

    /**
     * Questions that are different for each document. They can be linked to specific fields of members later on for automatic linking.
     */
    @field({ decoder: new ArrayDecoder(RecordCategory) })
    documentFieldCategories: RecordCategory[] = []

    @field({ decoder: NumberDecoder, nullable: true, optional: true })
    defaultMaxAge: number | null = null
}

export class DocumentTemplateGroup extends AutoEncoder {
    @field({ decoder: StringDecoder })
    groupId = ""

    @field({ decoder: NumberDecoder })
    cycle = 0

    /**
     * Answers for groupFieldCategories for this group
     */
    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder) })
    fieldAnswers: RecordAnswer[] = []
}

export class DocumentPrivateSettings extends AutoEncoder {
    @field({ decoder: DocumentTemplateDefinition })
    templateDefinition = DocumentTemplateDefinition.create({})

    /**
     * Groups for which the members will receive the document
     */
    @field({ decoder: new ArrayDecoder(DocumentTemplateGroup) })
    groups: DocumentTemplateGroup[] = []
}

export class DocumentTemplatePrivate extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(DocumentStatus) })
    status: DocumentStatus = DocumentStatus.Draft

    @field({ decoder: StringDecoder })
    html = ""

    @field({ decoder: DocumentSettings })
    settings = DocumentSettings.create({})

    @field({ decoder: DocumentPrivateSettings })
    privateSettings = DocumentPrivateSettings.create({})

    @field({ decoder: DateDecoder })
    createdAt = new Date()

    @field({ decoder: DateDecoder })
    updatedAt = new Date()
}

/**
 * Data stored with a document
 */
export class DocumentData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    name = ""
    
    /**
     * Contains a snapshot of all the answers
     */
    @field({ decoder: new ArrayDecoder(RecordAnswerDecoder) })
    fieldAnswers: RecordAnswer[] = []

    matchQuery(query: string) {
        return !!this.fieldAnswers.find(a => a.matchQuery(query))
    }
}

export class Document extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;
    
    @field({ decoder: new EnumDecoder(DocumentStatus) })
    status: DocumentStatus = DocumentStatus.Draft

    @field({ decoder: DocumentData })
    data = DocumentData.create({})

    @field({ decoder: DateDecoder })
    createdAt = new Date()

    @field({ decoder: DateDecoder })
    updatedAt = new Date()

    matchQuery(query: string) {
        return this.data.matchQuery(query)
    }
}