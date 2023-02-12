
import { column, Model } from "@simonbackx/simple-database";
import { Document as DocumentStruct, DocumentData, DocumentStatus } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { render } from "../helpers/Handlebars";
import { RegistrationWithMember } from "./Member";

export class Document extends Model {
    static table = "documents";

    @column({ primary: true, type: "string", beforeSave(value) {
        return value ?? uuidv4();
    } })
    id!: string;

    @column({ type: "string"})
    organizationId: string

    @column({ type: "string"})
    templateId: string

    /**
     * Used to give a member access to the document
     */
    @column({ type: "string", nullable: true })
    memberId: string | null = null

    /**
     * Used to identify document already created for a registration (= to update it)
     */
    @column({ type: "string", nullable: true })
    registrationId: string | null = null

    @column({ type: "string" })
    status = DocumentStatus.Draft

    /**
     * Assigned when exporting the document
     */
    @column({ type: "integer", nullable: true })
    number: number | null = null

    /**
     * Settings of the document. This information is public
     */
    @column({ type: "json", decoder: DocumentData })
    data = DocumentData.create({})

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

    getStructure() {
        return DocumentStruct.create(this)
    }

    buildContext() {
        // Convert the field answers in a simplified javascript object
        const data = {
            "id": this.id,
            "number": this.number,
            "created_at": this.createdAt
        };

        for (const field of this.data.fieldAnswers) {
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

    async updateData(): Promise<void> {
        if (!this.registrationId) {
            console.log('No registration id, skipping update')
            return
        }
        const DocumentTemplate = (await import("./DocumentTemplate")).DocumentTemplate
        const template = await DocumentTemplate.getByID(this.templateId)
        if (!template) {
            console.log('No template, skipping update')
            return
        }

        if (!template.updatesEnabled) {
            console.log('No updatesEnabled, skipping update')
            return
        }

        const Member = (await import("./Member")).Member
        const [registration] = await Member.getRegistrationWithMembersByIDs([this.registrationId])
        if (!registration) {
            console.log('No registration, skipping update')
            return
        }

        await template.updateDocumentFor(this, registration)
    }

    static async updateForMember(memberId: string) {
        try {
            console.log('Updating documents for member', memberId)
            const Member = (await import("./Member")).Member
            const member = await Member.getWithRegistrations(memberId)
            if (member) {
                await this.updateForRegistrations(member.registrations.map(r => r.id), member.organizationId)
            }
        } catch (e) {
            console.error(e)
        }
    }

    static async updateForRegistration(registration: RegistrationWithMember) {
        try {
            console.log('Updating documents for registration', registration.id)

            const DocumentTemplate = (await import("./DocumentTemplate")).DocumentTemplate
            const templates = await DocumentTemplate.where({updatesEnabled: 1, organizationId: registration.member.organizationId})

            for (const template of templates) {
                await template.createForRegistrationIfNeeded(registration)
            }
        } catch (e) {
            console.error(e)
        }
    }

    static async updateForRegistrations(registrationIds: string[], organizationId: string) {
        try {
            console.log('Updating documents for updateForRegistrations', registrationIds)

            const DocumentTemplate = (await import("./DocumentTemplate")).DocumentTemplate
            const templates = await DocumentTemplate.where({updatesEnabled: 1, organizationId})

            if (templates.length) {
                const Member = (await import("./Member")).Member
                const registrations = await Member.getRegistrationWithMembersByIDs(registrationIds)

                for (const template of templates) {
                    for (const registration of registrations) {
                        await template.createForRegistrationIfNeeded(registration)
                    }
                }
            }
        } catch (e) {
            console.error(e)
        }
    }

    // Rander handlebars template
    async getRenderedHtml(): Promise<string | null> {
        const DocumentTemplate = (await import("./DocumentTemplate")).DocumentTemplate
        const template = await DocumentTemplate.getByID(this.templateId)
        if (!template) {
            return null
        }

        return this.getRenderedHtmlForTemplate(template.html)
    }

    // Rander handlebars template
    private getRenderedHtmlForTemplate(htmlTemplate: string): string | null {
        try {
            const context = this.buildContext()
            const renderedHtml = render(htmlTemplate, context);
            return renderedHtml;
        } catch (e) {
            console.error('Failed to render document html', e)
            return null;
        }
    }
}
