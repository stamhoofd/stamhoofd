import { OrganizationTag } from '../Platform.js';

export class TagHelper {
    /**
     * Get the root tags from the tags array.
     * A root tag is a tag that is not a child of another tag in the array.
     * @param tags
     */
    static getRootTags(tags: OrganizationTag[]) {
        const result: OrganizationTag[] = [];

        for (const tag of tags) {
            const tagId = tag.id;
            let isRootTag = true;
            for (const otherTag of tags) {
                const otherTagId = otherTag.id;
                if (tagId === otherTagId) {
                    continue;
                }

                if (otherTag.childTags.includes(tagId)) {
                    isRootTag = false;
                    break;
                }
            }

            if (isRootTag) {
                result.push(tag);
            }
        }

        return result;
    }

    /**
     * Checks if a tag with the provided id contains the tag with the id to search recursively.
     * @param tagId id of the tag to search into
     * @param tagIdToSearch id of the tag to search inside the tag
     * @param tagMap a map of all the tags
     * @returns true if the tag contains the tag to search recursively or false otherwise
     */
    static containsDeep(tagId: string, tagIdToSearch: string, tags: { allTags: OrganizationTag[] } | { tagMap: Map<string, OrganizationTag> }): boolean {
        const tagMap = 'tagMap' in tags ? tags.tagMap : new Map(tags.allTags.map(tag => [tag.id, tag]));

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
            if (this.containsDeep(childTagId, tagIdToSearch, { tagMap })) {
                return true;
            }
        }

        return false;
    }
}
