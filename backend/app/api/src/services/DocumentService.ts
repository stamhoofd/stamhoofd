import { Model } from '@simonbackx/simple-database';
import { PlainObject } from '@simonbackx/simple-encoding';
import { Document, Group } from '@stamhoofd/models';

function getGroupFieldsAffectingDocuments(group: Group): PlainObject {
    return {
        type: group.type,
        startDate: group.settings.startDate.getTime(),
        endDate: group.settings.endDate.getTime(),
        name: group.settings.name.toString(),
    };
}

export class DocumentService {
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
                        console.log('Group changes cannot affect documents');
                        return;
                    }

                    // If a group is changed - update the documents for it
                    await Document.updateForGroup(event.model.id, event.model.organizationId);
                }
            }
            catch (e) {
                console.error('Failed to update documents after group change', e);
            }
        });
    }
};
