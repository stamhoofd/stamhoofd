import { OrganizationTag } from '../Platform.js';
import { TagHelper } from './TagHelper.js';

describe('TagHelper', () => {
    describe('getAllAncestors', () => {
        const town = OrganizationTag.create({ name: 'Town' });
        const region = OrganizationTag.create({ name: 'Region', childTags: [town.id] });
        const province = OrganizationTag.create({ name: 'Province', childTags: [region.id] });
        const other = OrganizationTag.create({ name: 'Other' });
        const allTags = [province, region, town, other];

        test('Returns all parents up to the root tag', () => {
            expect(TagHelper.getAllAncestors(town.id, { allTags }).sort()).toEqual([province.id, region.id].sort());
        });

        test('Returns nothing for a root tag', () => {
            expect(TagHelper.getAllAncestors(province.id, { allTags })).toEqual([]);
            expect(TagHelper.getAllAncestors(other.id, { allTags })).toEqual([]);
        });
    });
});
