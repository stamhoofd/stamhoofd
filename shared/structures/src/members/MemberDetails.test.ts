import 'jest-extended';

import { MemberDetails } from './MemberDetails.js';
import { Parent } from './Parent.js';

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
                }),
            ]);
        });
    });
});
