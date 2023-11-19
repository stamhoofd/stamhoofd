
import { column, ManyToOneRelation, Model } from "@simonbackx/simple-database";
import { DocumentData, DocumentPrivateSettings, DocumentSettings, DocumentStatus, DocumentTemplatePrivate, MemberWithRegistrations, RecordAddressAnswer, RecordAnswer, RecordAnswerDecoder, RecordDateAnswer, RecordPriceAnswer, RecordSettings, RecordTextAnswer, RecordType } from '@stamhoofd/structures';
import { Formatter, Sorter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { Document } from "./Document";
import { Group } from "./Group";
import { Member, RegistrationWithMember } from "./Member";
import { Registration } from "./Registration";
import { render } from "../helpers/Handlebars";
import { isSimpleError, isSimpleErrors, SimpleError } from "@simonbackx/simple-errors";
import { QueueHandler } from "@stamhoofd/queues";
import { Organization } from "./Organization";
import { field } from "@simonbackx/simple-encoding";

export class DocumentTemplate extends Model {
    static table = "document_templates";

    @column({ primary: true, type: "string", beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    /**
     * The HTML that is used to generate the PDF
     */
    @column({ type: "string" })
    html: string

    @column({ type: "string"})
    organizationId: string

    @column({ type: "string" })
    status = DocumentStatus.Draft

    @column({ type: "boolean" })
    updatesEnabled = true

    /**
     * Settings of the smart document. This information is public
     */
    @column({ type: "json", decoder: DocumentSettings })
    settings: DocumentSettings

    /**
     * 
     */
    @column({ type: "json", decoder: DocumentPrivateSettings })
    privateSettings: DocumentPrivateSettings

    @column({ type: "datetime" })
    createdAt: Date = new Date()

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    getPrivateStructure() {
        return DocumentTemplatePrivate.create(this)
    }

    /**
     * Returns the default answers for a given registration
     */
    async buildAnswers(registration: RegistrationWithMember): Promise<{fieldAnswers: RecordAnswer[], missingData: boolean}> {
        const fieldAnswers: RecordAnswer[] = []
        let missingData = false

        const group = await Group.getByID(registration.groupId)

        // Some fields are supported by default in linked fields
        const defaultData = {
            //"registration.startDate": registration.group.settings.startDate,
            //"registration.endDate": registration.group.settings.endDate,   
            "group.name": RecordTextAnswer.create({
                settings: RecordSettings.create({
                    id: "group.name",
                    type: RecordType.Text,
                }), // settings will be overwritten
                value: group?.settings?.name ?? ""
            }),    
            "registration.startDate": RecordDateAnswer.create({
                settings: RecordSettings.create({
                    id: "registration.startDate",
                    type: RecordType.Date,
                }), // settings will be overwritten
                dateValue: group?.settings?.getStartDate({cycle: registration.cycle === group.cycle ? undefined : registration.cycle}) ?? null
            }),
            "registration.endDate": RecordDateAnswer.create({
                settings: RecordSettings.create({
                    id: "registration.endDate",
                    type: RecordType.Date,
                }), // settings will be overwritten
                dateValue: group?.settings?.getEndDate({cycle: registration.cycle === group.cycle ? undefined : registration.cycle}) ?? null
            }),
            "registration.price": 
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    value: registration.price
                }),
            "registration.pricePaid": 
                RecordPriceAnswer.create({
                    settings: RecordSettings.create({}), // settings will be overwritten
                    value: registration.pricePaid
                }),
            "member.firstName": RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.firstName
            }),
            "member.lastName":  RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.lastName
            }),
            "member.address": RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: registration.member.details.address ?? null
            }),
            "member.birthDay": RecordDateAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                dateValue: registration.member.details.birthDay
            }),
            "parents[0].firstName": RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[0]?.firstName
            }),
            "parents[0].lastName": RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[0]?.lastName
            }),
            "parents[0].address": RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: registration.member.details.parents[0]?.address ?? null
            }),
            "parents[1].firstName": RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[1]?.firstName
            }),
            "parents[1].lastName": RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.member.details.parents[1]?.lastName
            }),
            "parents[1].address": RecordAddressAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                address: registration.member.details.parents[1]?.address ?? null
            }),
        }

        // Add data that is different for each member
        for (const field of this.privateSettings.templateDefinition.documentFieldCategories.flatMap(c => c.getAllRecords())) {
            // Where do we need to find the answer to this linked field?
            // - Could either return an id of a recordSetting connected to member
            // - or an idea of defaultData that is supported by default
            // The result is always a recordAnswer whose type should match the type of the linkedField
            const linkedToMemberAnswerSettingsIds = this.settings.linkedFields.get(field.id)

            let found = false;

            if (linkedToMemberAnswerSettingsIds) {
                for (const linkedToMemberAnswerSettingsId of linkedToMemberAnswerSettingsIds) {
                    if (linkedToMemberAnswerSettingsId) {
                        const answer = registration.member.details.recordAnswers.find(a => a.settings.id === linkedToMemberAnswerSettingsId);
                        if (answer && !answer.isEmpty && answer.settings.type === field.type) {  
                            // We need to link it with the settings in the template
                            const clone = answer.clone()
                            clone.settings = field
                            clone.reviewedAt = null // All linked fields are not reviewed. Unless they are manually changed by an admin later
                        
                            found = true
                            fieldAnswers.push(clone)
                            break;
                        }

                        // Check if supported by default
                        if (defaultData[linkedToMemberAnswerSettingsId] && !defaultData[linkedToMemberAnswerSettingsId].isEmpty) {
                            if (defaultData[linkedToMemberAnswerSettingsId] instanceof RecordAnswerDecoder.getClassForType(field.type)) {
                                // We need to clone here, because the same default data can be used in multiple places
                                const clone = defaultData[linkedToMemberAnswerSettingsId].clone()
                                clone.settings = field

                                found = true
                                fieldAnswers.push(clone)
                                break;
                            } else {
                                console.warn("Found type mismatch for default data: " + linkedToMemberAnswerSettingsId + " - " + field.id)
                            }
                        }
                    }
                }
            }

            if (!found && field.required) {
                missingData = true;
            }

            if (!found) {
                // Add placeholder (so we have proper warnings)
                const clone = RecordAnswerDecoder.getClassForType(field.type).create({
                    settings: field,
                })
                fieldAnswers.push(clone)
            }
        }

        // Add global answers (same for each document)
        for (const anwer of this.settings.fieldAnswers) {
            // todo: check duplicate
            anwer.reviewedAt = null
            fieldAnswers.push(anwer)
        }

        // Add group based answers (same for each group)
        for (const anwer of this.privateSettings.groups.find(g => g.groupId === registration.groupId && g.cycle === registration.cycle)?.fieldAnswers ?? []) {
            // todo: check duplicate
            anwer.reviewedAt = null
            fieldAnswers.push(anwer)
        }

        // Add other default data
        for (const key in defaultData) {
            if (defaultData[key] && defaultData[key].settings.id === key && !fieldAnswers.find(a => a.settings.id === key)) {
                fieldAnswers.push(defaultData[key])
            }
        }

        // Verify answers
        if (!missingData) {
            for (const answer of fieldAnswers) {
                try {
                    answer.validate()
                } catch (e) {
                    missingData = true
                    break;
                }
            }
        }

        return {
            fieldAnswers,
            missingData
        }
    }

    async createForRegistrationIfNeeded(registration: RegistrationWithMember) {
        // Check group and cycle
        for (const groupDefinition of this.privateSettings.groups) {
            if (groupDefinition.groupId === registration.groupId && groupDefinition.cycle === registration.cycle) {
                const document = await this.generateForRegistration(registration)
                if (document) {
                    await document.save()
                }
            }
        }
    }

    private async generateForRegistration(registration: RegistrationWithMember) {
        const {fieldAnswers, missingData} = await this.buildAnswers(registration)
        const existingDocuments = await Document.where({ templateId: this.id, registrationId: registration.id }, {limit: 1})

        if (!this.checkIncluded(registration, fieldAnswers)) {
            if (existingDocuments.length > 0) {
                for (const document of existingDocuments) {
                    await document.delete()
                }
            }
            return null
        }

        const fieldId = 'registration.startDate';
        let startDate: null | Date = null;

        for (const answer of fieldAnswers) {
            if (answer instanceof RecordDateAnswer) {
                if (answer.settings.id === fieldId && !answer.isEmpty) {
                    startDate = answer.dateValue;
                    break;
                }
            }
        }

        const group = await Group.getByID(registration.groupId)
        const description = `${registration.member.details.name}, ${group ? group.settings.name : ''}`;

        if (existingDocuments.length > 0) {
            for (const document of existingDocuments) {
                await this.updateDocumentFor(document, registration)
                document.data.name = this.settings.name
                document.data.description = description
                if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                    document.status = this.status;
                }
                await document.save()
                return document;
            }
        } else {
            const document = new Document()
            document.organizationId = this.organizationId
            document.templateId = this.id
            document.status = missingData ? DocumentStatus.MissingData : this.status;
            document.data = DocumentData.create({
                name: this.settings.name,
                description,
                fieldAnswers
            })
            document.memberId = registration.member.id
            document.registrationId = registration.id
            await document.save()
            return document;
        }
    }

    checkIncluded(registration: RegistrationWithMember, fieldAnswers: RecordAnswer[]) {
        if (this.settings.maxAge !== null) {
            const fieldId = 'registration.startDate';
            let startDate: null | Date = null;

            for (const answer of fieldAnswers) {
                if (answer instanceof RecordDateAnswer) {
                    if (answer.settings.id === fieldId && !answer.isEmpty) {
                        startDate = answer.dateValue;
                        break;
                    }
                }
            }

            if (startDate) {
                const age = registration.member.details.ageOnDate(startDate)

                if (age === null) {
                    console.warn("Missing member age checking maxAge")
                    return false;
                }

                if (age > this.settings.maxAge) {
                    return false;
                }
            } else {
                console.warn("Missing registration.startDate in fieldAnswers when checking maxAge")
            }
        }

        if (this.settings.minPrice !== null) {
            const fieldId = 'registration.price';
            let price: null | number = null;

            for (const answer of fieldAnswers) {
                if (answer instanceof RecordPriceAnswer) {
                    if (answer.settings.id === fieldId && answer.value !== null) {
                        price = answer.value;
                        break;
                    }
                }
            }

            if (price !== null) {
                if (price < this.settings.minPrice) {
                    return false;
                }
            } else {
                console.warn("Missing registration.price in fieldAnswers when checking minPrice")
            }
        }
        
        return true;
    }

    async buildAll({generateNumbers = false} = {}) {
        return await QueueHandler.schedule("documents-build-all/"+this.id, async () => {
            if (!this.updatesEnabled) {
                // Check status
                const documents = await Document.where({ templateId: this.id })
                for (const document of documents) {
                    if (document.status === DocumentStatus.Draft || document.status === DocumentStatus.Published) {
                        document.status = this.status;
                        await document.save();
                    }
                }
                return documents
            }
            
            console.log('Building all documents for template', this.id)
            const documentSet: Map<string, Document> = new Map()

            for (const groupDefinition of this.privateSettings.groups) {
                // Get the registrations for this group with this cycle
                const registrations = await Member.getRegistrationWithMembersForGroup(groupDefinition.groupId, groupDefinition.cycle)

                for (const registration of registrations) {
                    const document = await this.generateForRegistration(registration)
                    if (document) {
                        documentSet.set(document.id, document)
                    }
                }
            }

            // Delete documents that no longer match and don't have a number yet
            const documents = await Document.where({ templateId: this.id })
            for (const document of documents) {
                if (!documentSet.has(document.id)) {
                    if (document.number === null) {
                        await document.delete()
                    } else {
                        document.status = DocumentStatus.Deleted;
                        await document.save();
                    }
                }
            }

            const allDocuments = [...documentSet.values()]

            // Generate numbers for all documents
            if (generateNumbers) {
                let nextNumber = Math.max(0, ...allDocuments.map(d => d.number).filter(n => n !== null) as number[]) + 1
                for (const document of allDocuments) {
                    if (document.number === null && document.status === DocumentStatus.Published) {
                        document.number = nextNumber;
                        await document.save();
                        nextNumber++;
                    }
                }
            }

            return allDocuments
        });
    }

    private async buildContext(organization: Organization) {
        // Convert the field answers in a simplified javascript object
        const documents = (await this.buildAll({generateNumbers: true})).filter(d => d.status === DocumentStatus.Published && !!d.number).sort((a, b) => Sorter.byNumberValue(b.number ?? 0, a.number ?? 0))

        // Check numbers are strictly increasing
        let lastNumber = 0;
        for (const document of documents) {
            if (document.number !== lastNumber + 1) {
                throw new SimpleError({
                    code: "invalid_document_number",
                    message: 'Expected document number to be ' + (lastNumber + 1) + ' but got ' + document.number,
                    human: "Er ging iets mis bij het nummeren van de documenten (ben je zeker dat je geen documenten hebt verwijderd of toegevoegd sinds de vorige export?). Als je de export nog niet hebt gebruikt in Belcotax kan je de nummering resetten en de export opnieuw proberen.",
                })
            }
            lastNumber = document.number;
        }

        const data = {
            "id": this.id,
            "created_at": this.createdAt,
            "documents": documents.map(d => d.buildContext(organization)),
        };

        for (const field of this.settings.fieldAnswers) {
            const keys = field.settings.id.split('.')
            let current = data
            const lastKey = keys.pop()!
            if (!lastKey) {
                throw new Error("Invalid field id")
            }
            for (const key of keys) {
                if (!current[key]) {
                    current[key] = {}
                }
                current = current[key]

                if (typeof current !== "object") {
                    throw new Error("Invalid field type")
                }
            }
            current[lastKey] = field.objectValue
        }

        return data;
    }

    async getRenderedXml(organization: Organization) {
        if (!this.privateSettings.templateDefinition.xmlExport) {
            return null;
        }
        
        try {
            const context = await this.buildContext(organization)
            const renderedHtml = render(this.privateSettings.templateDefinition.xmlExport, context);
            return renderedHtml;
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                throw e;
            }
            console.error('Failed to render document html', e)
            return null;
        }
    }

    areAnswersComplete(answers: RecordAnswer[]) {
        for (const field of this.privateSettings.templateDefinition.documentFieldCategories.flatMap(c => c.getAllRecords())) {
            const answer = answers.find(a => a.settings.id === field.id)
            if (!answer) {
                return false;
            }
            // Update settings
            answer.settings = field
            try {
                answer.validate()
            } catch (e) {
                // Invalid
                return false;
            }
        }
        return true;
    }

    async updateDocumentFor(document: Document, registration: RegistrationWithMember) {
        const {fieldAnswers} = await this.buildAnswers(registration)
        const existingAnswers = document.data.fieldAnswers

        const newAnswers: RecordAnswer[] = existingAnswers.slice()

        for (const addAnswer of fieldAnswers) {
            const existingIndex = newAnswers.findIndex(a => a.settings.id === addAnswer.settings.id)
            const existing = existingIndex !== -1 ? newAnswers[existingIndex] : null
            if (existing) {
                // We already have an answer for this field, we'll only update it if addAnswer is reviewed later
                if (!existing.isReviewedAfter(addAnswer)) {
                    newAnswers[existingIndex] = addAnswer
                }
            } else {
                newAnswers.push(addAnswer)
            }
        }

        document.data.fieldAnswers = newAnswers
        const complete = this.areAnswersComplete(newAnswers)

        if (document.status !== DocumentStatus.Deleted) {
            if (!complete) {
                document.status = DocumentStatus.MissingData
            } else {
                if (document.status === DocumentStatus.MissingData) {
                    document.status = this.status
                }
            }
        }
    }
}
