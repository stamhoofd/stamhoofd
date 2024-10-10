import { Organization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { OrganizationTag, TagHelper as SharedTagHelper } from '@stamhoofd/structures';

export class TagHelper extends SharedTagHelper {
    static updateOrganizations(oldTags: OrganizationTag[], newTags: OrganizationTag[]) {
        const queueId = 'update-tags-on-organizations';
        QueueHandler.cancel(queueId);
        QueueHandler.schedule(queueId, async function (this: undefined) {
            const organizations = await Organization.all();

            await TagHelper.updateTagsOnOrganizations(organizations, oldTags, newTags);
        }).catch(console.error);
    }

    private static async updateTagsOnOrganizations(organizations: Organization[], oldTags: OrganizationTag[], newTags: OrganizationTag[]) {
        const newTagsMap = new Map<string, OrganizationTag>(newTags.map(t => [t.id, t]));
        const oldTagsMap = new Map<string, OrganizationTag>(oldTags.map(t => [t.id, t]));
        const newAutoAddTagMap = this.createAutoAddTagMap(newTagsMap);
        const oldAutoAddTagMap = this.createAutoAddTagMap(oldTagsMap);

        for (const organization of organizations) {
            organization.meta.tags = this.getUpdatedOrganizationTagIds(organization.meta.tags, newAutoAddTagMap, oldAutoAddTagMap);
        }

        await Promise.all(organizations.map(organization => organization.save()));
    }
}
