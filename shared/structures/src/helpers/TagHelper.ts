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
