import { Model } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { OrganizationTag, TagHelper as SharedTagHelper } from '@stamhoofd/structures';

export class TagHelper extends SharedTagHelper {
    static updateOrganizations(oldTags: OrganizationTag[], newTags: OrganizationTag[]) {
        const queueId = 'update-tags-on-organizations';
        QueueHandler.cancel(queueId);

        const newTagsMap = new Map<string, OrganizationTag>(newTags.map(t => [t.id, t]));
        const oldTagsMap = new Map<string, OrganizationTag>(oldTags.map(t => [t.id, t]));
        const newAutoAddTagMap = this.createAutoAddTagMap(newTagsMap);
        const oldAutoAddTagMap = this.createAutoAddTagMap(oldTagsMap);

        QueueHandler.schedule(queueId, async () => {
            await this.loopOrganizations(async (organizations) => {
                for (const organization of organizations) {
                    organization.meta.tags = this.getUpdatedOrganizationTagIds(organization.meta.tags, newAutoAddTagMap, oldAutoAddTagMap);
                }

                await Promise.all(organizations.map(organization => organization.save()));
            });
        }).catch(console.error);
    }

    private static async loopOrganizations(onBatchReceived: (batch: Organization[]) => Promise<void>) {
        await loopModels(Organization, 'id', onBatchReceived, { limit: 10 });
    }
}

// todo: move for reuse?
type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

// todo: move for reuse?
// todo: add option for extending default where
async function loopModels<M extends typeof Model>(m: M, idKey: KeysMatching<InstanceType<M>, string> & string, onBatchReceived: (batch: InstanceType<M>[]) => Promise<void>, options: { limit?: number } = {}) {
    let lastId = '';
    const limit = options.limit ?? 10;

    while (true) {
        const models = await m.where(
            { [idKey]: { sign: '>', value: lastId } },
            { limit, sort: [idKey] });

        if (models.length === 0) {
            break;
        }

        await onBatchReceived(models);

        lastId
                = models[
                models.length - 1
            ][idKey] as string;
    }
}
