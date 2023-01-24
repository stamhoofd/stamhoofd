
import { column, Model } from "@simonbackx/simple-database";
import { DocumentData, DocumentPrivateSettings, DocumentSettings, DocumentStatus, DocumentTemplatePrivate, MemberWithRegistrations } from '@stamhoofd/structures';
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

    buildDataTree(registration: RegistrationWithMember) {
        const dataTree = {}
        let missingData = false

        // Some fields are supported by default in linked fields
        const defaultData = {
            //"registration.startDate": registration.group.settings.startDate,
            //"registration.endDate": registration.group.settings.endDate,
            "registration.price": registration.price,
            "member.firstName": registration.member.firstName,
            "member.lastName": registration.member.details.lastName,
            "member.address": registration.member.details.address ?? registration.member.details.parents[0]?.address ?? null,
            "member.birthDay": registration.member.details.birthDay,
        }

        // Add data that is different for each member
        for (const field of this.privateSettings.templateDefinition.linkedFields) {
            const linkedToMemberAnswerSettingsId = this.settings.linkedFields.get(field.id)
            if (linkedToMemberAnswerSettingsId) {
                const answer = registration.member.details.recordAnswers.find(a => a.settings.id === linkedToMemberAnswerSettingsId);
                if (answer) {
                    dataTree[field.id] = answer.stringValue
                } else {
                    missingData = true
                }
            } else {
                // Check if supported by default
                if (defaultData[field.id]) {
                    dataTree[field.id] = defaultData[field.id]
                } else {
                    missingData = true
                }
            }
        }

        // Add global answers (same for each document)
        for (const anwer of this.settings.fieldAnswers) {
            // todo: use object value instead of string value
            dataTree[anwer.settings.id] = anwer.stringValue;
        }

        // Add group based answers (same for each group)
        for (const anwer of this.privateSettings.groups.find(g => g.groupId === registration.groupId && g.cycle === registration.cycle)?.fieldAnswers ?? []) {
            dataTree[anwer.settings.id] = anwer.stringValue;
        }

        // Always incldue birthDay if this.settings.maxAge is set
        if (this.settings.maxAge !== null && !dataTree["member.birthDay"]) {
            dataTree["member.birthDay"] = defaultData["member.birthDay"]
        }

        return {
            dataTree,
            missingData
        }
    }

    async generateForRegistration(registration: RegistrationWithMember) {
        const {dataTree, missingData} = this.buildDataTree(registration)

        if (!this.checkIncluded(dataTree)) {
            return null
        }

        const existingDocuments = await Document.where({ templateId: this.id, registrationId: registration.id }, {limit: 1})
        if (existingDocuments.length > 0) {
            const document = existingDocuments[0]
            // TODO: maybe merge instead of override the data in case administrators manually changed something
            document.data.data = dataTree
            document.status = missingData ? DocumentStatus.MissingData : (document.status === DocumentStatus.MissingData ? DocumentStatus.Draft : document.status)
            await document.save()
            return document;
        } else {
            const document = new Document()
            document.organizationId = this.organizationId
            document.templateId = this.id
            document.status = missingData ? DocumentStatus.MissingData : DocumentStatus.Draft
            document.data = DocumentData.create({
                data: dataTree
            })
            document.memberId = registration.member.id
            document.registrationId = registration.id
            await document.save()
            return document;
        }
    }

    checkIncluded(dataTree: any) {
        if (this.settings.maxAge !== null) {
            if (dataTree['registration.startDate'] && dataTree['member.birthDay']) {
                const startDate = Formatter.luxon(new Date(dataTree['registration.startDate']))
                const birthDay = Formatter.luxon(new Date(dataTree['member.birthDay']))

                // Check the member is at least maxAge years old at the start of the registration
                let age = startDate.year - birthDay.year;
                const m = startDate.month - birthDay.month
                if (m < 0 || (m === 0 && startDate.day < birthDay.day)) {
                    age--;
                }

                console.log('Checking age', age, 'of', dataTree['member.firstName'], dataTree['member.lastName'],  'against maxAge', this.settings.maxAge)

                if (age <= this.settings.maxAge) {
                    return true;
                }
                return false;

            } else {
                console.warn("Missing registration.startDate or member.birthDay in dataTree when checking maxAge")
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
