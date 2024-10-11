import { Model } from '@simonbackx/simple-database';
import { Organization } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { OrganizationTag, TagHelper as SharedTagHelper } from '@stamhoofd/structures';

export class TagHelper extends SharedTagHelper {
    static updateOrganizations(platformTags: OrganizationTag[]) {
        const queueId = 'update-tags-on-organizations';
        QueueHandler.cancel(queueId);

        QueueHandler.schedule(queueId, async () => {
            await this.loopOrganizations(async (organizations) => {
                for (const organization of organizations) {
                    organization.meta.tags = this.getAllTagsFromHierarchy(organization.meta.tags, platformTags);
                }

                await Promise.all(organizations.map(organization => organization.save()));
            });
        }).catch(console.error);
    }

    private static async loopOrganizations(onBatchReceived: (batch: Organization[]) => Promise<void>) {
        await loopModels(Organization, 'id', onBatchReceived, { limit: 10 });
    }

    static getAllTagsFromHierarchy(tagIds: string[], platformTags: OrganizationTag[]) {
        const result = new Set<string>();
        const tagMap = new Map(platformTags.map(tag => [tag.id, tag]));

        this.recursivelyGetAllTagsFromHierarchy(tagIds, tagMap, result);
        return Array.from(result);
    }

    private static recursivelyGetAllTagsFromHierarchy(tagIds: string[], tagMap: Map<string, OrganizationTag>, result: Set<string>): void {
        for (const tagId of tagIds) {
            const tag = tagMap.get(tagId);
            if (tag) {
                result.add(tagId);

                const addedChildTags: string[] = [];

                for (const [otherId, otherTag] of tagMap.entries()) {
                    if (otherId === tagId) {
                        tagMap.delete(tagId);
                        continue;
                    }
                    if (otherTag.childTags.some(childTagId => childTagId === tagId)) {
                        if (!result.has(otherId)) {
                            addedChildTags.push(otherId);
                        }
                    }
                }

                if (addedChildTags.length > 0) {
                    this.recursivelyGetAllTagsFromHierarchy(addedChildTags, tagMap, result);
                }
            }
        }
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
