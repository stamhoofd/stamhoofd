
import { column, Model } from "@simonbackx/simple-database";
import { DocumentData, DocumentPrivateSettings, DocumentSettings, DocumentStatus, DocumentTemplatePrivate, MemberWithRegistrations, RecordAddressAnswer, RecordAnswer, RecordDateAnswer, RecordSettings, RecordTextAnswer } from '@stamhoofd/structures';
import { Formatter } from "@stamhoofd/utility";
import { v4 as uuidv4 } from "uuid";
import { Document } from "./Document";
import { Member, RegistrationWithMember } from "./Member";

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
    buildAnswers(registration: RegistrationWithMember): {fieldAnswers: RecordAnswer[], missingData: boolean} {
        const fieldAnswers: RecordAnswer[] = []
        let missingData = false

        // Some fields are supported by default in linked fields
        const defaultData = {
            //"registration.startDate": registration.group.settings.startDate,
            //"registration.endDate": registration.group.settings.endDate,
            "registration.price":  // TODO!: ADD PRICE TYPE!
            RecordTextAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                value: registration.price?.toString()
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
                address: registration.member.details.address ?? registration.member.details.parents[0]?.address ?? null
            }),
            "member.birthDay": RecordDateAnswer.create({
                settings: RecordSettings.create({}), // settings will be overwritten
                dateValue: registration.member.details.birthDay
            }),
        }

        // Add data that is different for each member
        for (const field of this.privateSettings.templateDefinition.documentFieldCategories.flatMap(c => c.getAllRecords())) {
            // Where do we need to find the answer to this linked field?
            // - Could either return an id of a recordSetting connected to member
            // - or an idea of defaultData that is supported by default
            // The result is always a recordAnswer whose type should match the type of the linkedField
            const linkedToMemberAnswerSettingsId = this.settings.linkedFields.get(field.id)
            if (linkedToMemberAnswerSettingsId) {
                const answer = registration.member.details.recordAnswers.find(a => a.settings.id === linkedToMemberAnswerSettingsId);
                if (answer) {
                    // We need to link it with the settings in the template
                    const clone = answer.clone()
                    clone.settings = field
                    clone.reviewedAt = null // All linked fields are not reviewed. Unless they are manually changed by an admin later
                    // -> we'll always use the answer that has been reviewed if we have a conflict
                    fieldAnswers.push(clone)
                    continue;
                } 
            }
            // Check if supported by default
            if (defaultData[field.id] && !defaultData[field.id].isEmpty) {
                defaultData[field.id].settings = field
                fieldAnswers.push(defaultData[field.id])
            } else {
                missingData = true
            }
        }

        // Add global answers (same for each document)
        for (const anwer of this.settings.fieldAnswers) {
            // todo: check duplicate
            fieldAnswers.push(anwer)
        }

        // Add group based answers (same for each group)
        for (const anwer of this.privateSettings.groups.find(g => g.groupId === registration.groupId && g.cycle === registration.cycle)?.fieldAnswers ?? []) {
            // todo: check duplicate
            fieldAnswers.push(anwer)
        }

        return {
            fieldAnswers,
            missingData
        }
    }

    async generateForRegistration(registration: RegistrationWithMember) {
        const {fieldAnswers, missingData} = this.buildAnswers(registration)

        if (!this.checkIncluded(registration, fieldAnswers)) {
            return null
        }

        const existingDocuments = await Document.where({ templateId: this.id, registrationId: registration.id }, {limit: 1})
        if (existingDocuments.length > 0) {
            const document = existingDocuments[0]
            // TODO: maybe merge instead of override the data in case administrators manually changed something
            document.data.fieldAnswers = fieldAnswers
            document.status = missingData ? DocumentStatus.MissingData : (document.status === DocumentStatus.MissingData ? DocumentStatus.Draft : document.status)
            await document.save()
            return document;
        } else {
            const document = new Document()
            document.organizationId = this.organizationId
            document.templateId = this.id
            document.status = missingData ? DocumentStatus.MissingData : DocumentStatus.Draft
            document.data = DocumentData.create({
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

                if (age <= this.settings.maxAge) {
                    return true;
                }
                return false;

            } else {
                console.warn("Missing registration.startDate in fieldAnswers when checking maxAge")
            }
        }
        return true;
    }

    async buildAll() {
        console.log('Building all documents for template', this.id)
        
        for (const groupDefinition of this.privateSettings.groups) {
            // Get the registrations for this group with this cycle
            const registrations = await Member.getRegistrationWithMembersForGroup(groupDefinition.groupId, groupDefinition.cycle)

            for (const registration of registrations) {
                await this.generateForRegistration(registration)
            }
        }
    }
}
