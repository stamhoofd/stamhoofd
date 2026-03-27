import { AuditLogPatchItem, AuditLogPatchItemType, AuditLogReplacement, MemberDetails, Parent } from '@stamhoofd/structures';
import { ObjectDiffer } from './ObjectDiffer.js';

describe('ObjectDiffer', () => {
    test('Changing a string field', () => {
        const a = MemberDetails.create({
            firstName: 'Simon',
            lastName: 'Tester',
        });
        const b = a.patch({
            lastName: 'Test',
        });

        expect(ObjectDiffer.diff(a, b)).toEqual([
            AuditLogPatchItem.create({
                type: AuditLogPatchItemType.Changed,
                key: AuditLogReplacement.key('lastName'),
                oldValue: AuditLogReplacement.string('Tester'),
                value: AuditLogReplacement.string('Test'),
            }),
        ]);
    });

    test('Adding a string field', () => {
        const a = MemberDetails.create({
            firstName: 'Simon',
        });
        const b = a.patch({
            memberNumber: '1234',
        });

        expect(ObjectDiffer.diff(a, b)).toEqual([
            AuditLogPatchItem.create({
                type: AuditLogPatchItemType.Added,
                key: AuditLogReplacement.key('memberNumber'),
                value: AuditLogReplacement.string('1234'),
            }),
        ]);
    });

    test('Adding a relation field', () => {
        const a = MemberDetails.create({
            firstName: 'Simon',
        });
        const b = a.patch({
            parents: [
                Parent.create({
                    firstName: 'Ouder',
                }),
            ],
        });

        expect(ObjectDiffer.diff(a, b)).toEqual([
            AuditLogPatchItem.create({
                type: AuditLogPatchItemType.Added,
                key: AuditLogReplacement.array([AuditLogReplacement.key('parents'), AuditLogReplacement.string('Ouder (%2Z)')]),
            }),
        ]);
    });

    test('Removing a relation field', () => {
        const a = MemberDetails.create({
            firstName: 'Simon',
            parents: [
                Parent.create({
                    firstName: 'Ouder',
                }),
            ],
        });
        const b = a.patch({
            parents: [],
        });

        expect(ObjectDiffer.diff(a, b)).toEqual([
            AuditLogPatchItem.create({
                type: AuditLogPatchItemType.Removed,
                key: AuditLogReplacement.array([AuditLogReplacement.key('parents'), AuditLogReplacement.string('Ouder (%2Z)')]),
            }),
        ]);
    });

    test('Changing a relation field', () => {
        const a = MemberDetails.create({
            firstName: 'Simon',
            parents: [
                Parent.create({
                    firstName: 'Ouder',
                }),
            ],
        });
        const b = a.patch({
            parents: [
                Parent.create({
                    id: a.parents[0].id,
                    firstName: 'Oudertje',
                    createdAt: a.parents[0].createdAt
                }),
            ],
        });

        expect(ObjectDiffer.diff(a, b)).toEqual([
            AuditLogPatchItem.create({
                type: AuditLogPatchItemType.Changed,
                key: AuditLogReplacement.array([AuditLogReplacement.key('parents'), AuditLogReplacement.string('Ouder (%2Z)'), AuditLogReplacement.key('firstName')]),
                oldValue: AuditLogReplacement.string('Ouder'),
                value: AuditLogReplacement.string('Oudertje'),
            }),
        ]);
    });
});
