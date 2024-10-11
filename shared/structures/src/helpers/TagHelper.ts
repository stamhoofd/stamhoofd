import { OrganizationTag } from '../Platform';

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
}
