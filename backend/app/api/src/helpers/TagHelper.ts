import { Organization, Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { AuditLogSource, OrganizationTag, TagHelper as SharedTagHelper } from '@stamhoofd/structures';
import { AuditLogService } from '../services/AuditLogService.js';

export class TagHelper extends SharedTagHelper {
    static async updateOrganizations() {
        const queueId = 'update-tags-on-organizations';
        QueueHandler.cancel(queueId);

        await AuditLogService.setContext({ source: AuditLogSource.System }, async () => {
            await QueueHandler.schedule(queueId, async () => {
                const sharedPlatform = await Platform.getShared();

                const tagCounts = new Map<string, number>();

                for await (const organization of Organization.select().all()) {
                    organization.meta.tags = this.getAllTagsFromHierarchy(organization.meta.tags, sharedPlatform.config.tags);

                    for (const tag of organization.meta.tags) {
                        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
                    }
                    await organization.save();
                }

                // Reload platform to avoid race conditions
                const platform = await Platform.getForEditing();
                for (const [tag, count] of tagCounts.entries()) {
                    const tagObject = platform.config.tags.find(t => t.id === tag);
                    if (tagObject) {
                        tagObject.organizationCount = count;
                    }
                }
                await platform.save();
            });
        });
    }

    /**
     * Removes child tag ids that do not exist and sorts the tags.
     * @param platformTags
     * @returns
     */
    static getCleanedUpTags(platformTags: OrganizationTag[]): OrganizationTag[] {
        const existingTags = new Set(platformTags.map(t => t.id));

        for (const tag of platformTags) {
            tag.childTags = tag.childTags.filter(tag => existingTags.has(tag));
        }

        return this.getSortedTags(platformTags);
    }

    private static getSortedTags(tags: OrganizationTag[]): OrganizationTag[] {
        // keep original order, but add child tags below parent tag
        const map = new Map(tags.map(tag => [tag.id, tag]));
        const rootTags = this.getRootTags(tags);
        const sortedTags = this.sortTagsHelper(rootTags, map);

        return Array.from(sortedTags);
    }

    private static sortTagsHelper(tags: OrganizationTag[], allTagsMap: Map<string, OrganizationTag>): Set<OrganizationTag> {
        // set to prevent duplicates
        const result = new Set<OrganizationTag>();

        for (const tag of tags) {
            result.add(tag);
            if (tag.childTags) {
                const childTags = tag.childTags.map(id => allTagsMap.get(id)).filter(x => x !== undefined);
                this.sortTagsHelper(childTags, allTagsMap).forEach(tag => result.add(tag));
            }
        }

        return result;
    }

    static validateTags(platformTags: OrganizationTag[]): boolean {
        const tagMap = new Map(platformTags.map(tag => [tag.id, tag]));

        for (const tag of platformTags) {
            const tagId = tag.id;

            if (tag.childTags.includes(tagId)) {
                // a tag cannot contain itself
                console.error(`Tag ${tag.name} contains itself.`);
                return false;
            }

            let isChildTag = false;

            for (const otherTag of platformTags) {
                const otherTagId = otherTag.id;

                if (tagId === otherTagId) {
                    continue;
                }

                const isChildOfOtherTag = otherTag.childTags.includes(tagId);

                if (isChildOfOtherTag) {
                    if (isChildTag) {
                        // a tag can only be a child tag of 1 tag
                        console.error(`Tag ${tag.name} is a child tag of multiple tags.`);
                        return false;
                    }

                    isChildTag = true;

                    // infinite loop should not be possible
                    // infinite loop if tag contains other tag in hierarchy
                    if (this.containsDeep(tagId, otherTagId, { tagMap })) {
                        console.error(`Tag ${tag.name} contains an infinite loop with ${otherTag.name}.`);
                        return false;
                    }
                }
            }
        }

        return true;
    }

    static getAllTagsFromHierarchy(tagIds: string[], platformTags: OrganizationTag[]) {
        const result = new Set<string>();
        const tagMap = new Map(platformTags.map(tag => [tag.id, tag]));

        this.recursivelyGetAllTagsFromHierarchy(tagIds, tagMap, result);
        const sorted = Array.from(result);

        // Sort tags based on platform config order
        sorted.sort((a, b) => {
            const aIndex = platformTags.findIndex(t => t.id === a);
            const bIndex = platformTags.findIndex(t => t.id === b);
            return aIndex - bIndex;
        });

        return sorted;
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
