import { OrganizationTag } from '../Platform';

export class TagHelper {
    /**
     * Checks if a tag with the provided id contains the tag with the id to search recursively.
     * @param tagId id of the tag to search into
     * @param tagIdToSearch id of the tag to search inside the tag
     * @param tagMap a map of all the tags
     * @returns true if the tag contains the tag to search recursively or false otherwise
     */
    static containsDeep(tagId: string, tagIdToSearch: string, tagMap: Map<string, OrganizationTag>): boolean {
        const tag = tagMap.get(tagId);
        if (!tag) {
            // should not happen
            return false;
        }

        if (tag.childTags.length === 0) {
            return false;
        }

        if (tag.childTags.includes(tagIdToSearch)) {
            return true;
        }

        for (const childTagId of tag.childTags) {
            if (this.containsDeep(childTagId, tagIdToSearch, tagMap)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Create a map containing each tag where the value is a set of all the tags that should be added automatically to an organization if the organization contains the tag.
     * @param tagMap a map of all the tags
     */
    static createAutoAddTagMap(tagMap: Map<string, OrganizationTag>): Map<string, Set<string>> {
        const result = new Map<string, Set<string>>(Array.from(tagMap.keys()).map(tagId => [tagId, new Set([tagId])]));

        for (const tagId of tagMap.keys()) {
            const set = result.get(tagId)!;

            for (const otherTagId of tagMap.keys()) {
                if (set.has(otherTagId)) {
                    continue;
                }

                if (this.containsDeep(otherTagId, tagId, tagMap)) {
                    set.add(otherTagId);
                }
            }
        }

        return result;
    }

    /**
     *
     * @param tagIds the list of tag ids of an organization
     * @param platformTags the tags of the platform
     * @returns the new array of tag ids after syncing with the platform:
     * - new tag ids can be added if they recursively contain a tag from the original array
     * - tags can be removed if they were
     */
    static getTagIdsAfterSyncWithPlatformTags(originalTagIds: string[], newTagIds: string[], platformTags: OrganizationTag[]) {
        const map = this.createAutoAddTagMap(new Map(platformTags.map(t => [t.id, t])));
        const manuallyAddedTags = this.getManuallyAddedTags(originalTagIds, map)
            // filter out tags that were deleted
            .filter(tagId => newTagIds.includes(tagId));

        // add tags that were added
        for (const newTag of newTagIds) {
            if (!manuallyAddedTags.includes(newTag)) {
                manuallyAddedTags.push(newTag);
            }
        }

        return this.automaticallyAddTags(manuallyAddedTags, map);
    }

    /**
     * Return an updated list of organization tag ids given the old and new tags
     * @param organization the organization to update the tags for
     * @param newAutoAddTagMap a map containing all the tag ids and where the value is a set of tag ids that should be added also if the organization contains the tag id, according to the new tags
     * @param oldAutoAddTagMap a map containing all the tag ids and where the value is a set of tag ids that should be added also if the organization contains the tag id, according to the old tags
     */
    static getUpdatedOrganizationTagIds(tagIds: string[], newAutoAddTagMap: Map<string, Set<string>>, oldAutoAddTagMap: Map<string, Set<string>>) {
        const manuallyAddedTags = this.getManuallyAddedTags(tagIds, oldAutoAddTagMap);
        return this.automaticallyAddTags(manuallyAddedTags, newAutoAddTagMap);
    }

    static automaticallyAddTags(manuallyAddedTags: string[], autoAddTagMap: Map<string, Set<string>>) {
        const resultSet = new Set<string>();

        for (const tagId of manuallyAddedTags) {
            const set = autoAddTagMap.get(tagId);
            if (set) {
                for (const tagToAdd of set.values()) {
                    resultSet.add(tagToAdd);
                }
            }
        }

        return Array.from(resultSet);
    }

    static getTagsThatWillBeAddedAutomatically(manuallyAddedTags: string[], autoAddTagMap: Map<string, Set<string>>) {
        const resultSet = new Set<string>();

        for (const tagId of manuallyAddedTags) {
            const set = autoAddTagMap.get(tagId);
            if (set) {
                for (const tagToAdd of set.values()) {
                    if (tagToAdd !== tagId) {
                        resultSet.add(tagToAdd);
                    }
                }
            }
        }

        return Array.from(resultSet);
    }

    static getManuallyAddedTags(originalTagIds: string[], autoAddTagMap: Map<string, Set<string>>) {
        return originalTagIds.filter((tagId) => {
            const isAddedBecauseOfOtherTag = originalTagIds.some((otherTagId) => {
                if (otherTagId === tagId) {
                    return false;
                }
                const set = autoAddTagMap.get(otherTagId);
                return set && set.has(tagId);
            });

            return !isAddedBecauseOfOtherTag;
        });
    }
}
