import { OrganizationTag } from '@stamhoofd/structures';
import { TagHelper } from './TagHelper';

// todo: move tests for methods of shared package to shared package
describe('TagHelper', () => {
    describe('containsDeep', () => {
        it('should return true if the tag contains the tag to search recursively or false otherwise', () => {
            // arrange
            const tags = new Map<string, OrganizationTag>([
                [
                    'id1',
                    OrganizationTag.create({
                        id: 'id1',
                        name: 'tag1',
                        childTags: [],
                    }),
                ],
                [
                    'id2',
                    OrganizationTag.create({
                        id: 'id2',
                        name: 'tag2',
                        childTags: [],
                    }),
                ],
                [
                    'id3',
                    OrganizationTag.create({
                        id: 'id3',
                        name: 'tag3',
                        childTags: ['id2', 'id4'],
                    }),
                ],
                [
                    'id4',
                    OrganizationTag.create({
                        id: 'id4',
                        name: 'tag4',
                        childTags: ['id5'],
                    }),
                ],
                [
                    'id5',
                    OrganizationTag.create({
                        id: 'id5',
                        name: 'tag5',
                        childTags: [],
                    }),
                ],
            ]);

            // act
            const doesTag3ContainTag4 = TagHelper.containsDeep('id3', 'id4', tags);
            const doesTag3ContainTag5 = TagHelper.containsDeep('id3', 'id5', tags);
            const doesTag3ContainTag1 = TagHelper.containsDeep('id3', 'id1', tags);

            // assert
            expect(doesTag3ContainTag4).toBe(true);
            expect(doesTag3ContainTag5).toBe(true);
            expect(doesTag3ContainTag1).toBe(false);
        });
    });

    describe('createAutoAddTagMap', () => {
        it('should create a map containing each tag where the value is a set of all the tags that should be added automatically to an organization if the organization contains the tag', () => {
            // arrange
            const tags = new Map<string, OrganizationTag>([
                [
                    'id1',
                    OrganizationTag.create({
                        id: 'id1',
                        name: 'tag1',
                        childTags: [],
                    }),
                ],
                [
                    'id2',
                    OrganizationTag.create({
                        id: 'id2',
                        name: 'tag2',
                        childTags: [],
                    }),
                ],
                [
                    'id3',
                    OrganizationTag.create({
                        id: 'id3',
                        name: 'tag3',
                        childTags: ['id2', 'id4'],
                    }),
                ],
                [
                    'id4',
                    OrganizationTag.create({
                        id: 'id4',
                        name: 'tag4',
                        childTags: ['id5'],
                    }),
                ],
                [
                    'id5',
                    OrganizationTag.create({
                        id: 'id5',
                        name: 'tag5',
                        childTags: [],
                    }),
                ],
            ]);

            // act
            const autoTagMap = TagHelper.createAutoAddTagMap(tags);
            const id1Set = autoTagMap.get('id1');
            const id2Set = autoTagMap.get('id2');
            const id5Set = autoTagMap.get('id5');

            // assert
            expect(id1Set?.size).toBe(1);
            expect(id1Set?.has('id1')).toBe(true);

            expect(id2Set?.size).toBe(2);
            expect(id2Set?.has('id2')).toBe(true);
            expect(id2Set?.has('id3')).toBe(true);

            expect(id5Set?.size).toBe(3);
            expect(id5Set?.has('id5')).toBe(true);
            expect(id5Set?.has('id4')).toBe(true);
            expect(id5Set?.has('id3')).toBe(true);
        });
    });

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
