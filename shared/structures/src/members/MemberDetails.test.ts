import { ObjectData } from '@simonbackx/simple-encoding';
import { Address } from '../addresses/Address.js';
import { MemberDetails } from './MemberDetails.js';
import { Parent } from './Parent.js';
import { UitpasNumberDetails, UitpasSocialTariff, UitpasSocialTariffStatus } from './UitpasNumberDetails.js';

describe('Correctly merge multiple details together', () => {
    test('Merge', () => {
        const parent = Parent.create({
            firstName: 'Gekke',
            lastName: 'Test',
        });
        // The user gave permission for data collection
        const original = MemberDetails.create({
            firstName: 'Robot',
            parents: [
                Parent.create({
                    firstName: 'Linda',
                    lastName: 'Aardappel',
                }),
                parent,
            ],
        });

        // The user didn't gave permissons for data collection
        const incoming = MemberDetails.create({
            firstName: 'Robot',
            parents: [
                Parent.create({
                    firstName: 'Andere',
                    lastName: 'Test',
                }),
                Parent.create({
                    firstName: 'Linda',
                    lastName: 'Aardappel',
                }),
                Parent.create({
                    id: parent.id,
                    firstName: 'Gewijzigd',
                    lastName: 'Aardappel',
                }),
            ],
        });

        // Only keep the heart + food allergies
        original.merge(incoming);

        expect(original.parents.map(r => r.firstName)).toEqual(['Linda', 'Gewijzigd', 'Andere']);
    });

    describe('mergeParents', () => {
        test('Parents with the same name', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                email: 'parent1@gmail.com',
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                email: 'parent2@gmail.com',
                createdAt: new Date(1500),
            });

            const parent3 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(500),
                email: 'parent3@gmail.com',
                createdAt: new Date(0),
            });

            // The user didn't gave permissons for data collection
            const incoming = MemberDetails.create({
                firstName: 'Robot',
                parents: [
                    parent1,
                    parent2,
                    parent3,
                ],
            });

            MemberDetails.mergeParents([incoming]);
            expect(incoming.parents).toEqual([
                Parent.create({
                    ...parent2,
                    createdAt: new Date(0),
                    id: parent3.id,
                    alternativeEmails: [
                        parent1.email!,
                        parent3.email!,
                    ],
                }),
            ]);
        });

        test('The olderst id and createdAt are always maintained', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                email: 'parent1@gmail.com',
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                email: 'parent2@gmail.com',
                createdAt: new Date(0), // we'll thse this one + id
            });

            const parent3 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(500),
                email: 'parent3@gmail.com',
                createdAt: new Date(200),
            });

            // The user didn't gave permissons for data collection
            const incoming = MemberDetails.create({
                firstName: 'Robot',
                parents: [
                    parent1,
                    parent2,
                    parent3,
                ],
            });

            MemberDetails.mergeParents([incoming]);
            expect(incoming.parents).toEqual([
                Parent.create({
                    ...parent2,
                    alternativeEmails: [
                        parent1.email!,
                        parent3.email!,
                    ],
                }),
            ]);
        });

        test('Parents with the same id override each other', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                email: 'parent1@gmail.com',
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                email: 'parent2@gmail.com',
                createdAt: new Date(1500),
            });

            const parent3 = Parent.create({
                id: parent1.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(500),
                email: 'parent3@gmail.com',
                createdAt: new Date(0),
            });

            // The user didn't gave permissons for data collection
            const incoming = MemberDetails.create({
                firstName: 'Robot',
                parents: [
                    parent1,
                    parent2,
                    parent3,
                ],
            });

            MemberDetails.mergeParents([incoming]);
            expect(incoming.parents).toEqual([
                Parent.create({
                    ...parent2,
                    createdAt: new Date(0), // Oldest created at is still used
                }),
            ]);
        });

        test('Merging happens across id and names', () => {
            // History:
            // 1_000: Parent created with name 'Gekke Test'
            // 2_000: Parent added an email address with the same id
            // 3_000: Some member created the same parent with name 'Gekke Test' but a different ID
            // 4_000: The name of that second parent was changed to 'Gekke2 Test2'
            // 5_000: The email address of the second parent was changed to 'gekke2@example.com'

            // We have 5 members, each with a copy of the parent at that time - if we merge them, we should get the changes in order merged.

            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                email: 'oldest@example.com', // This is ignored because it is overwritten by a parent with the same id
                createdAt: new Date(1000),
                updatedAt: new Date(1000),
            });

            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Gekke',
                lastName: 'Test',
                email: 'gekke@example.com',
                createdAt: new Date(1000),
                updatedAt: new Date(2000),
            });

            const parent3 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                email: 'gekke@example.com',
                createdAt: new Date(3000),
                updatedAt: new Date(3000),
            });

            const parent4 = Parent.create({
                id: parent3.id,
                firstName: 'Gekke2',
                lastName: 'Test',
                email: 'gekke@example.com',
                // Because the id has changed here, we'll merge the parents with a different id
                createdAt: new Date(3000),
                updatedAt: new Date(4000),
            });

            const parent5 = Parent.create({
                id: parent3.id,
                firstName: 'Gekke2',
                lastName: 'Test',
                email: 'gekke2@example.com',
                createdAt: new Date(3000),
                updatedAt: new Date(5000),
            });

            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [
                    parent1,
                ],
            });

            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [
                    parent2,
                ],
            });

            const member3 = MemberDetails.create({
                firstName: 'Member 3',
                parents: [
                    parent3,
                ],
            });

            const member4 = MemberDetails.create({
                firstName: 'Member 4',
                parents: [
                    parent4,
                ],
            });

            const member5 = MemberDetails.create({
                firstName: 'Member 5',
                parents: [
                    parent5,
                ],
            });

            MemberDetails.mergeParents([member1, member2, member3, member4, member5]);

            const expectedParent = Parent.create({
                id: parent1.id, // Id is maintained when parents are merged with same name
                firstName: 'Gekke2',
                lastName: 'Test',
                email: 'gekke2@example.com',
                alternativeEmails: [
                    'gekke@example.com', // this is kept because there was an id change
                ],
                createdAt: new Date(1000), // First created at
                updatedAt: new Date(5000), // Last change
            });

            expect(member1.parents).toEqual([expectedParent]);
            expect(member2.parents).toEqual([expectedParent]);
            expect(member3.parents).toEqual([expectedParent]);
            expect(member4.parents).toEqual([expectedParent]);
            expect(member5.parents).toEqual([expectedParent]);

            // The parent object should reference the same object for each member
            expect(member1.parents[0]).toStrictEqual(member2.parents[0]);
            expect(member1.parents[0]).toStrictEqual(member3.parents[0]);
            expect(member1.parents[0]).toStrictEqual(member4.parents[0]);
            expect(member1.parents[0]).toStrictEqual(member5.parents[0]);
        });
    });

    describe('taxDependent', () => {
        test('taxDependent doesnt change on both family members', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                email: 'parent1@gmail.com',
                taxDependent: true,
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                email: 'parent2@gmail.com',
                createdAt: new Date(1500),
            });

            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [
                    parent1,
                ],
            });

            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [
                    parent2,
                ],
            });

            MemberDetails.mergeParents([member1, member2]);

            expect(member1.parents[0].taxDependent).toBe(true);
            expect(member2.parents[0].taxDependent).toBeNull();
        });

        test('changing name doesnt change taxDependent', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                taxDependent: true,
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Gewijzigde',
                lastName: 'Naam',
                updatedAt: new Date(2000),
                taxDependent: false,
                createdAt: new Date(500),
            });

            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [parent1],
            });
            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [parent2],
            });

            MemberDetails.mergeParents([member1, member2]);

            expect(member1.parents[0].name).toBe('Gewijzigde Naam');
            expect(member2.parents[0].name).toBe('Gewijzigde Naam');
            expect(member1.parents[0].taxDependent).toBe(true);
            expect(member2.parents[0].taxDependent).toBe(false);
        });

        test('changing email doesnt change taxDependent', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                email: 'old@example.com',
                taxDependent: true,
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                email: 'new@example.com',
                taxDependent: false,
                createdAt: new Date(500),
            });

            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [parent1],
            });
            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [parent2],
            });

            MemberDetails.mergeParents([member1, member2]);

            expect(member1.parents[0].email).toBe('new@example.com');
            expect(member2.parents[0].email).toBe('new@example.com');
            expect(member1.parents[0].taxDependent).toBe(true);
            expect(member2.parents[0].taxDependent).toBe(false);
        });

        test('changing address doesnt change taxDependent', () => {
            const oldAddress = Address.create({
                street: 'Old street',
                number: '1',
                postalCode: '1000',
                city: 'Brussels',
            });
            const newAddress = Address.create({
                street: 'New street',
                number: '2',
                postalCode: '9000',
                city: 'Ghent',
            });
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                address: oldAddress,
                taxDependent: true,
                createdAt: new Date(500),
            });

            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                address: newAddress,
                taxDependent: false,
                createdAt: new Date(500),
            });

            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [parent1],
            });
            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [parent2],
            });

            MemberDetails.mergeParents([member1, member2]);

            expect(member1.parents[0].address).toEqual(newAddress);
            expect(member2.parents[0].address).toEqual(newAddress);
            expect(member1.parents[0].taxDependent).toBe(true);
            expect(member2.parents[0].taxDependent).toBe(false);
        });

        test('merging keeps most recent taxDependent', () => {
            const parent1 = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                taxDependent: false,
                createdAt: new Date(500),
            });
            const parent2 = Parent.create({
                id: parent1.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                taxDependent: true,
                createdAt: new Date(500),
            });
            const member = MemberDetails.create({
                firstName: 'Member',
                parents: [parent1, parent2],
            });

            MemberDetails.mergeParents([member]);

            expect(member.parents).toHaveLength(1);
            expect(member.parents[0].taxDependent).toBe(true);
        });

        test('keeps each family member taxDependent when one member has duplicate parents', () => {
            const original = Parent.create({
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(1000),
                email: 'old@example.com',
                taxDependent: true,
                createdAt: new Date(500),
            });
            const duplicate = Parent.create({
                id: original.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(3000),
                email: 'new@example.com',
                taxDependent: false,
                createdAt: new Date(500),
            });
            const otherMemberParent = Parent.create({
                id: original.id,
                firstName: 'Gekke',
                lastName: 'Test',
                updatedAt: new Date(2000),
                email: 'intermediate@example.com',
                taxDependent: true,
                createdAt: new Date(500),
            });
            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [original, duplicate],
            });
            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [otherMemberParent],
            });

            MemberDetails.mergeParents([member1, member2]);

            expect(member1.parents).toHaveLength(1);
            expect(member2.parents).toHaveLength(1);
            expect(member1.parents[0].email).toBe('new@example.com');
            expect(member2.parents[0].email).toBe('new@example.com');
            expect(member1.parents[0].taxDependent).toBe(false);
            expect(member2.parents[0].taxDependent).toBe(true);
        });

        test('keeps taxDependent through name and id changes', () => {
            const parent1 = Parent.create({
                firstName: 'Original',
                lastName: 'Name',
                updatedAt: new Date(1000),
                taxDependent: true,
                createdAt: new Date(500),
            });
            const parent2 = Parent.create({
                firstName: 'Original',
                lastName: 'Name',
                updatedAt: new Date(2000),
                taxDependent: false,
                createdAt: new Date(1500),
            });
            const parent3 = Parent.create({
                id: parent2.id,
                firstName: 'Updated',
                lastName: 'Name',
                updatedAt: new Date(3000),
                taxDependent: null,
                createdAt: new Date(1500),
            });
            const member1 = MemberDetails.create({ firstName: 'Member 1', parents: [parent1] });
            const member2 = MemberDetails.create({ firstName: 'Member 2', parents: [parent2] });
            const member3 = MemberDetails.create({ firstName: 'Member 3', parents: [parent3] });

            MemberDetails.mergeParents([member1, member2, member3]);

            expect(member1.parents[0].name).toBe('Updated Name');
            expect(member2.parents[0].name).toBe('Updated Name');
            expect(member3.parents[0].name).toBe('Updated Name');
            expect(member1.parents[0].taxDependent).toBe(true);
            expect(member2.parents[0].taxDependent).toBe(false);
            expect(member3.parents[0].taxDependent).toBeNull();
        });

        test('does not mix taxDependent between different parents', () => {
            const sharedParent1 = Parent.create({
                firstName: 'Shared',
                lastName: 'Parent',
                updatedAt: new Date(1000),
                taxDependent: true,
                createdAt: new Date(500),
            });
            const sharedParent2 = Parent.create({
                id: sharedParent1.id,
                firstName: 'Updated shared',
                lastName: 'Parent',
                updatedAt: new Date(2000),
                taxDependent: false,
                createdAt: new Date(500),
            });
            const unrelatedParent = Parent.create({
                firstName: 'Unrelated',
                lastName: 'Parent',
                updatedAt: new Date(3000),
                taxDependent: null,
                createdAt: new Date(2500),
            });
            const member1 = MemberDetails.create({
                firstName: 'Member 1',
                parents: [sharedParent1, unrelatedParent],
            });
            const member2 = MemberDetails.create({
                firstName: 'Member 2',
                parents: [sharedParent2],
            });

            MemberDetails.mergeParents([member1, member2]);

            expect(member1.parents).toHaveLength(2);
            expect(member1.parents[0].name).toBe('Updated shared Parent');
            expect(member1.parents[0].taxDependent).toBe(true);
            expect(member1.parents[1]).toEqual(unrelatedParent);
            expect(member2.parents[0].taxDependent).toBe(false);
        });
    });

    describe('Should correctly merge UitpasNumberDetails', () => {
        const cases: { details1: MemberDetails; details2: MemberDetails; expectedUitpasNumber: string }[] = [
            {
                details1: MemberDetails.create({
                    firstName: 'Member 1',
                    uitpasNumberDetails: UitpasNumberDetails.create({
                        uitpasNumber: '12345678',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Unknown,
                            endDate: null,
                            updatedAt: new Date(2000, 0, 1),
                        }),
                    }),
                }),
                details2: MemberDetails.create({
                    firstName: 'Member 2',
                    uitpasNumberDetails: UitpasNumberDetails.create({
                        uitpasNumber: '87654321',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Active,
                            endDate: new Date(2023, 0, 1),
                            updatedAt: new Date(2000, 0, 2),
                        }),
                    }),
                }),
                expectedUitpasNumber: '87654321',
            },
            {
                details1: MemberDetails.create({
                    firstName: 'Member 1',
                    uitpasNumberDetails: UitpasNumberDetails.create({
                        uitpasNumber: '12345678',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Unknown,
                            endDate: null,
                            updatedAt: new Date(2000, 0, 1),
                        }),
                    }),
                }),
                details2: MemberDetails.create({
                    firstName: 'Member 2',
                    uitpasNumberDetails: UitpasNumberDetails.create({
                        uitpasNumber: '87654321',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Active,
                            endDate: new Date(2023, 0, 1),
                            updatedAt: new Date(1999, 11, 31),
                        }),
                    }),
                }),
                expectedUitpasNumber: '12345678',
            },
            {
                details1: MemberDetails.create({
                    firstName: 'Member 1',

                }),
                details2: MemberDetails.create({
                    firstName: 'Member 2',
                    uitpasNumberDetails: UitpasNumberDetails.create({
                        uitpasNumber: '87654321',
                        socialTariff: UitpasSocialTariff.create({
                            status: UitpasSocialTariffStatus.Active,
                            endDate: new Date(2023, 0, 1),
                            updatedAt: new Date(1999, 11, 31),
                        }),
                    }),
                }),
                expectedUitpasNumber: '87654321',
            },
        ];

        cases.forEach(({ details1, details2, expectedUitpasNumber }, index) => {
            test(`Case ${index + 1}`, () => {
                // act
                details1.merge(details2);

                // assert
                expect(details1.uitpasNumberDetails?.uitpasNumber).toBe(expectedUitpasNumber);
            });
        });
    });

    describe('uitpasNumber (version 306) upgrade to uitpasNumberDetails', () => {
        test('should upgrade uitpasNumber to uitpasNumberDetails', () => {
            const data = {
                firstName: 'Test',
                lastName: 'Test',
                uitpasNumber: '12345678',
            };

            const objectData = new ObjectData(data, { version: 306 });
            const decoded = objectData.decode(MemberDetails);

            expect(decoded).toMatchObject({
                uitpasNumberDetails: {
                    uitpasNumber: '12345678',
                    socialTariff: {
                        status: UitpasSocialTariffStatus.Unknown,
                        endDate: null,
                    },
                },
            });
        });

        test('should stay null if null', () => {
            const data = {
                firstName: 'Test',
                lastName: 'Test',
                uitpasNumber: null,
            };

            const objectData = new ObjectData(data, { version: 306 });
            const decoded = objectData.decode(MemberDetails);

            expect(decoded).toMatchObject({
                uitpasNumberDetails: null,
            });
        });
    });

    describe('uitpasNumberDetails downgrade to uitpasNumber (version 306)', () => {
        test('should upgrade uitpasNumber to uitpasNumberDetails', () => {
            const memberDetails = MemberDetails.create({
                firstName: 'Test',
                lastName: 'Test',
                uitpasNumberDetails: UitpasNumberDetails.create({
                    uitpasNumber: '12345678',
                    socialTariff: UitpasSocialTariff.create({
                        status: UitpasSocialTariffStatus.Unknown,
                        endDate: null,
                    }),
                }),
            });

            const encoded = memberDetails.encode({ version: 306 });

            expect(encoded).toMatchObject({
                uitpasNumber: '12345678',
            });
        });

        test('should stay null if null', () => {
            const memberDetails = MemberDetails.create({
                firstName: 'Test',
                lastName: 'Test',
                uitpasNumberDetails: null,
            });

            const encoded = memberDetails.encode({ version: 306 });

            expect(encoded).toMatchObject({
                uitpasNumber: null,
            });
        });
    });
});
