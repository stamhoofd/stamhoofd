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

    describe('cleanupTags', () => {
        it('should remove child tag ids that do not exist', () => {
            // arrange
            const tag5 = OrganizationTag.create({
                id: 'id5',
                name: 'tag5',
                childTags: ['doesNotExist2'],
            });

            const tag7 = OrganizationTag.create({
                id: 'id7',
                name: 'tag7',
                childTags: ['id6', 'id8', 'id9', 'doesNotExist1'],
            });

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
                tag5,
                OrganizationTag.create({
                    id: 'id6',
                    name: 'tag6',
                    childTags: ['id5'],
                }),
                tag7,
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
            TagHelper.cleanupTags(platformTags);

            // assert
            expect(tag5.childTags).toHaveLength(0);
            expect(tag7.childTags).toHaveLength(3);
            expect(tag7.childTags).not.toInclude('doesNotExist1');
        });
    });

    describe('validateTags', () => {
        it('should return false if a tag is a child tag of itself', () => {
            // arrange
            const invalidPlatformTags: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: ['id1'],
                }),
            ];

            const validPlatformTags: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: ['id2'],
                }),
                OrganizationTag.create({
                    id: 'id2',
                    name: 'tag2',
                    childTags: [],
                }),
            ];

            // act
            const result1 = TagHelper.validateTags(invalidPlatformTags);
            const result2 = TagHelper.validateTags(validPlatformTags);

            // assert
            expect(result1).toBeFalse();
            expect(result2).toBeTrue();
        });

        it('should return false if a tag is a child tag of multiple tags', () => {
            // arrange
            const invalidPlatformTags: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id2',
                    name: 'tag2',
                    childTags: ['id1'],
                }),
                OrganizationTag.create({
                    id: 'id3',
                    name: 'tag3',
                    childTags: ['id1'],
                }),
            ];

            const validPlatformTags: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id2',
                    name: 'tag2',
                    childTags: ['id3'],
                }),
                OrganizationTag.create({
                    id: 'id3',
                    name: 'tag3',
                    childTags: ['id1'],
                }),
            ];

            // act
            const result1 = TagHelper.validateTags(invalidPlatformTags);
            const result2 = TagHelper.validateTags(validPlatformTags);

            // assert
            expect(result1).toBeFalse();
            expect(result2).toBeTrue();
        });

        it('should return false if the child tags contain an infinite loop', () => {
            // arrange
            const platformTagsWithInfiniteLoop: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: ['id2'],
                }),
                OrganizationTag.create({
                    id: 'id2',
                    name: 'tag2',
                    childTags: ['id3'],
                }),
                OrganizationTag.create({
                    id: 'id3',
                    name: 'tag3',
                    childTags: ['id1'],
                }),
            ];

            // act
            const result = TagHelper.validateTags(platformTagsWithInfiniteLoop);

            // assert
            expect(result).toBeFalse();
        });
    });
});
