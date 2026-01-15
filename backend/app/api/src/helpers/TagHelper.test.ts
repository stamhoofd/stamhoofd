import { OrganizationTag } from '@stamhoofd/structures';
import { TagHelper } from './TagHelper.js';

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
            const doesTag3ContainTag4 = TagHelper.containsDeep('id3', 'id4', { tagMap: tags });
            const doesTag3ContainTag5 = TagHelper.containsDeep('id3', 'id5', { tagMap: tags });
            const doesTag3ContainTag1 = TagHelper.containsDeep('id3', 'id1', { tagMap: tags });

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
            expect(result).toContain('id5');
            expect(result).toContain('id3');
            expect(result).toContain('id4');
            expect(result).toContain('id6');
            expect(result).toContain('id7');
            expect(result).toContain('id0');
            expect(result).not.toContain('unknownTagId');
        });
    });

    describe('getCleanedUpTags', () => {
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
            TagHelper.getCleanedUpTags(platformTags);

            // assert
            expect(tag5.childTags).toHaveLength(0);
            expect(tag7.childTags).toHaveLength(3);
            expect(tag7.childTags).not.toContain('doesNotExist1');
        });

        it('should return array of tags in the correct order', () => {
            // arrange
            const platformTags: OrganizationTag[] = [
                OrganizationTag.create({
                    id: 'id2b1',
                    name: 'tag2b1',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id1',
                    name: 'tag1',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id2',
                    name: 'tag2',
                    childTags: ['id2a', 'id2b'],
                }),
                OrganizationTag.create({
                    id: 'id3',
                    name: 'tag3',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id2a',
                    name: 'tag2a',
                    childTags: ['id2a1', 'id2a2'],
                }),
                OrganizationTag.create({
                    id: 'id2b',
                    name: 'tag2b',
                    childTags: ['id2b1'],
                }),
                OrganizationTag.create({
                    id: 'id2a1',
                    name: 'tag2a1',
                    childTags: [],
                }),
                OrganizationTag.create({
                    id: 'id2a2',
                    name: 'tag2a2',
                    childTags: [],
                }),
            ];

            // act
            const result = TagHelper.getCleanedUpTags(platformTags);

            // assert
            expect(result).toHaveLength(8);
            expect(result[0].id).toBe('id1');
            expect(result[1].id).toBe('id2');
            expect(result[2].id).toBe('id2a');
            expect(result[3].id).toBe('id2a1');
            expect(result[4].id).toBe('id2a2');
            expect(result[5].id).toBe('id2b');
            expect(result[6].id).toBe('id2b1');
            expect(result[7].id).toBe('id3');
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
