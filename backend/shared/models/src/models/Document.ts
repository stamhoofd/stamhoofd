import { column } from '@simonbackx/simple-database';
import { DocumentData, DocumentStatus, Document as DocumentStruct, Platform, Version } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { QueryableModel } from '@stamhoofd/sql';
import { render } from '../helpers/Handlebars.js';
import { Member, MemberWithRegistrations, MemberWithUsersRegistrationsAndGroups, RegistrationWithMember } from './Member.js';
import { Organization } from './Organization.js';
import { Registration } from './Registration.js';

export class Document extends QueryableModel {
    static table = 'documents';

    @column({ primary: true, type: 'string', beforeSave(value) {
        return value ?? uuidv4();
    } })
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

    @column({ type: 'string' })
    status = DocumentStatus.Draft;

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

    @column({ type: 'datetime' })
    createdAt: Date = new Date();

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;

    getStructure() {
        return DocumentStruct.create(this);
    }

    buildContext(organization: Organization) {
        // Convert the field answers in a simplified javascript object
        const data: Record<string, any> = {
            id: this.id,
            name: this.data.name,
            number: this.number,
            created_at: this.createdAt,
            organization: {
                name: organization.name,
                companyName: organization.meta.companies[0]?.name || organization.name,
                companyNumber: organization.meta.companies[0]?.companyNumber || null,
                address: organization.address,
                companyAddress: organization.meta.companies[0]?.address ?? organization.address,
            },
        };
        const platformLogo = Platform.shared.config.logoDocuments ?? Platform.shared.config.horizontalLogo ?? Platform.shared.config.squareLogo;
        const organizationLogo = organization.meta.horizontalLogo ?? organization.meta.squareLogo;

        if (organizationLogo) {
            data['organization'] = {
                ...data['organization'],
                logo: organizationLogo.encode({ version: Version }) ?? null,
            };
        }

        if (platformLogo) {
            data['platform'] = {
                logo: platformLogo.encode({ version: Version }) ?? null,
            };
        }

        for (const field of this.data.fieldAnswers.values()) {
            const keys = field.settings.id.split('.');
            let current = data;
            const lastKey = keys.pop()!;
            if (!lastKey) {
                throw new Error('Invalid field id');
            }
            for (const key of keys) {
                if (!current[key]) {
                    current[key] = {};
                }
                current = current[key];

                if (typeof current !== 'object') {
                    throw new Error('Invalid field type');
                }
            }
            current[lastKey] = field.objectValue;
        }
        return data;
    }

    async updateData(): Promise<void> {
        const DocumentTemplate = (await import('./DocumentTemplate.js')).DocumentTemplate;
        const template = await DocumentTemplate.getByID(this.templateId);
        if (!template) {
            console.log('No template, skipping update');
            return;
        }

        if (!template.updatesEnabled) {
            console.log('No updates enabled when updating document', this.id);
            // do update, without taking new data from the registration into account
            await template.updateDocumentWithAnswers(this, this.data.fieldAnswers);
            return;
        }

        if (!this.registrationId) {
            console.log('No registration id when updating document', this.id);
            await template.updateDocumentWithAnswers(this, this.data.fieldAnswers);
            return;
        }

        const Member = (await import('./Member.js')).Member;
        const registration = await Registration.getByID(this.registrationId);
        if (!registration) {
            console.log('No registration when updating document', this.id);
            await template.updateDocumentWithAnswers(this, this.data.fieldAnswers);
            return;
        }

        const [loadedRegistration] = await Member.loadMembersForRegistrations([registration]);
        await template.updateDocumentFor(this, loadedRegistration);
    }

    static async updateForMember(memberOrId: string | Member | MemberWithRegistrations) {
        try {
            console.log('Updating documents for member', typeof memberOrId === 'string' ? memberOrId : memberOrId.id);
            const Member = (await import('./Member.js')).Member;
            const member = typeof memberOrId === 'string' ? await Member.getByID(memberOrId) : memberOrId;
            if (member) {
                const [loadedMember] = await Member.loadRegistrations([member]);
                const organizationIds = Formatter.uniqueArray(loadedMember.registrations.map(r => r.organizationId));
                for (const organizationId of organizationIds) {
                    await this.updateForRegistrations(loadedMember.registrations.filter(r => r.registeredAt && r.deactivatedAt === null && r.organizationId === organizationId).map(r => r.id), organizationId);
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    static async updateForRegistration(registration: RegistrationWithMember) {
        try {
            console.log('Updating documents for registration', registration.id);

            const DocumentTemplate = (await import('./DocumentTemplate.js')).DocumentTemplate;
            const templates = await DocumentTemplate.where({ updatesEnabled: 1, organizationId: registration.organizationId });

            for (const template of templates) {
                await template.updateForRegistration(registration);
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    static async deleteForRegistrations(registrations: Registration[]) {
        if (registrations.length === 0) {
            return [];
        }

        const existingDocuments = await Document.where({ registrationId: { sign: 'IN', value: registrations.map(r => r.id) } });

        for (const document of existingDocuments) {
            console.log('Deleting document for registration', document.registrationId);
            await document.delete();
        }
    }

    static async updateForRegistrations(registrationIds: string[] | Registration[], organizationId: string) {
        if (!registrationIds.length) {
            return;
        }
        try {
            console.log('Updating documents for updateForRegistrations', registrationIds, organizationId);

            const DocumentTemplate = (await import('./DocumentTemplate.js')).DocumentTemplate;
            const templates = await DocumentTemplate.where({ updatesEnabled: 1, organizationId });

            if (templates.length) {
                const Member = (await import('./Member.js')).Member;
                const registrations = registrationIds.length === 0 || typeof registrationIds[0] !== 'string' ? (registrationIds as Registration[]) : await Member.getRegistrationWithMembersByIDs(registrationIds as string[]);
                const loadedRegistrations = await Member.loadMembersForRegistrations(registrations);

                for (const template of templates) {
                    await template.updateForRegistrations(loadedRegistrations);
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    static async updateForGroup(groupId: string, organizationId: string) {
        try {
            console.log('Updating documents for group', groupId);

            const DocumentTemplate = (await import('./DocumentTemplate.js')).DocumentTemplate;
            const templates = await DocumentTemplate.where({ updatesEnabled: 1, organizationId });

            if (templates.length) {
                const Member = (await import('./Member.js')).Member;
                const registrations = await Member.getRegistrationWithMembersForGroup(groupId);

                for (const template of templates) {
                    await template.updateForRegistrations(registrations);
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    // Rander handlebars template
    async getRenderedHtml(organization: Organization): Promise<string | null> {
        const DocumentTemplate = (await import('./DocumentTemplate.js')).DocumentTemplate;
        const template = await DocumentTemplate.getByID(this.templateId);
        if (!template) {
            return null;
        }

        return await this.getRenderedHtmlForTemplate(organization, template.html);
    }

    // Rander handlebars template
    private async getRenderedHtmlForTemplate(organization: Organization, htmlTemplate: string): Promise<string | null> {
        try {
            const context = this.buildContext(organization);
            const renderedHtml = await render(htmlTemplate, context);
            return renderedHtml;
        }
        catch (e) {
            console.error('Failed to render document html', e);
            return null;
        }
    }
}
