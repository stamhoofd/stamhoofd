import { OrganizationTag } from '@stamhoofd/structures';
import { TagHelper } from './TagHelper';

// todo: move tests for methods of shared package to shared package
describe('TagHelper', () => {
    describe('getAllTagsFromHierarchy', () => {
        it('should return array with the tag ids that are known by the platform and add tag ids if the organization has a tag that is a child tag of that tag', () => {
            // arrange
            const originalTagIds: string[] = ['id5', 'id3', 'unknownTagId'];
            const platformTags: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id0',
                    name: 'tag0',
                    childTags: ['id7', 'id9'],
                }),
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id2',
                    name: 'tag2',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id3',
                    name: 'tag3',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id4',
                    name: 'tag4',
                    childTags: ['id3'],
                }),
                OrganizationTag.create({
                    id: 'id5',
                    name: 'tag5',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id6',
                    name: 'tag6',
                    childTags: ['id5'],
                }),
                OrganizationTag.create({
                    id: 'id7',
                    name: 'tag7',
                    childTags: ['id6', 'id8', 'id9'],
                }),
                OrganizationTag.create({
                    id: 'id8',
                    name: 'tag8',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id9',
                    name: 'tag9',
                    childTags: [],
                }),
            ];

            // act
            const result = TagHelper.getAllTagsFromHierarchy(originalTagIds, platformTags);

            // assert
            expect(result).toHaveLength(6);
            expect(result).toInclude('id5');
            expect(result).toInclude('id3');
            expect(result).toInclude('id4');
            expect(result).toInclude('id6');
            expect(result).toInclude('id7');
            expect(result).toInclude('id0');
            expect(result).not.toInclude('unknownTagId');
        });
    });
});
