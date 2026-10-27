import { Model } from '@simonbackx/simple-database';
import type { PlainObject } from '@common/encoding';
import type { MemberWithRegistrations, RegistrationWithMember } from '@stamhoofd/models/models/Member.js';
import { DocumentTemplate } from '@stamhoofd/models/models/DocumentTemplate.js';
import { Group } from '@stamhoofd/models/models/Group.js';
import type { Document } from '@stamhoofd/models/models/Document.js';
import { Member } from '@stamhoofd/models/models/Member.js';
import { Registration } from '@stamhoofd/models/models/Registration.js';
import { Formatter } from '@stamhoofd/utility';

function getGroupFieldsAffectingDocuments(group: Group): PlainObject {
    return {
        type: group.type,
        startDate: group.settings.startDate.getTime(),
        endDate: group.settings.endDate.getTime(),
        name: group.settings.name.toString(),
    };
}

export class DocumentService {
    static async updateData(document: Document): Promise<void> {
        if (document.isLocked) {
            console.log('Document is locked, skipping update');
            return;
        }

        const template = await DocumentTemplate.getByID(document.templateId);
        if (!template) {
            console.log('No template, skipping update');
            return;
        }

        if (!template.updatesEnabled) {
            console.log('No updates enabled when updating document', document.id);
            // Keep the document's answers when template updates are disabled.
            await template.updateDocumentWithAnswers(document, document.data.fieldAnswers);
            return;
        }

        if (!document.registrationId) {
            console.log('No registration id when updating document', document.id);
            await template.updateDocumentWithAnswers(document, document.data.fieldAnswers);
            return;
        }

        const registration = await Registration.getByID(document.registrationId);
        if (!registration) {
            console.log('No registration when updating document', document.id);
            await template.updateDocumentWithAnswers(document, document.data.fieldAnswers);
            return;
        }

        const [loadedRegistration] = await Member.loadMembersForRegistrations([registration]);
        await template.updateDocumentFor(document, loadedRegistration);
    }

    static async updateForMember(memberOrId: string | Member | MemberWithRegistrations) {
        try {
            console.log('Updating documents for member', typeof memberOrId === 'string' ? memberOrId : memberOrId.id);
            const member = typeof memberOrId === 'string' ? await Member.getByID(memberOrId) : memberOrId;
            if (member) {
                const [loadedMember] = await Member.loadRegistrations([member]);
                const organizationIds = Formatter.uniqueArray(loadedMember.registrations.map(r => r.organizationId));
                for (const organizationId of organizationIds) {
                    await this.updateForRegistrations(loadedMember.registrations.filter(r => r.registeredAt && r.deactivatedAt === null && r.organizationId === organizationId).map(r => r.id), organizationId);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    static async updateForRegistration(registration: RegistrationWithMember) {
        try {
            console.log('Updating documents for registration', registration.id);
            const templates = await DocumentTemplate.where({ updatesEnabled: 1, isLocked: 0, organizationId: registration.organizationId });

            for (const template of templates) {
                await template.updateForRegistration(registration);
            }
        } catch (e) {
            console.error(e);
        }
    }

    static async updateForRegistrations(registrationIds: string[] | Registration[], organizationId: string) {
        if (!registrationIds.length) {
            return;
        }
        try {
            console.log('Updating documents for updateForRegistrations', registrationIds, organizationId);
            const templates = await DocumentTemplate.where({ updatesEnabled: 1, isLocked: 0, organizationId });

            if (templates.length) {
                const registrations = registrationIds.length === 0 || typeof registrationIds[0] !== 'string' ? (registrationIds as Registration[]) : await Member.getRegistrationWithMembersByIDs(registrationIds as string[]);
                const loadedRegistrations = await Member.loadMembersForRegistrations(registrations);

                for (const template of templates) {
                    await template.updateForRegistrations(loadedRegistrations);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    static async updateForGroup(groupId: string, organizationId: string) {
        try {
            console.log('Updating documents for group', groupId);
            const templates = await DocumentTemplate.where({ updatesEnabled: 1, isLocked: 0, organizationId });

            if (templates.length) {
                const registrations = await Member.getRegistrationWithMembersForGroup(groupId);

                for (const template of templates) {
                    await template.updateForRegistrations(registrations);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    static listening = false;

    static listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        Model.modelEventBus.addListener(this, async (event) => {
            try {
                if (event.model instanceof Group && event.type === 'updated' && event.changedFields.settings && !event.model.deletedAt) {
                    const oldModel = event.getOldModel() as Group;
                    const oldFields = getGroupFieldsAffectingDocuments(oldModel);
                    const newFields = getGroupFieldsAffectingDocuments(event.model);

                    if (JSON.stringify(oldFields) === JSON.stringify(newFields)) {
                        return;
                    }

                    // If a group is changed - update the documents for it
                    await DocumentService.updateForGroup(event.model.id, event.model.organizationId);
                }
            } catch (e) {
                console.error('Failed to update documents after group change', e);
            }
        });
    }
};
