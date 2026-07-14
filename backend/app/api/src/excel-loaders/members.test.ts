import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { PlatformMember } from '@stamhoofd/structures';
import { EmergencyContact, MemberDetails, MembersBlob, MemberWithRegistrationsBlob, Organization, Platform, PlatformFamily } from '@stamhoofd/structures';
import { baseMemberColumns } from './members.js';

describe('Member excel export', () => {
    describe('emergencyContacts column', () => {
        function createMember(emergencyContacts: EmergencyContact[]) {
            const organization = Organization.create({});
            const blob = MembersBlob.create({
                organizations: [organization],
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({ firstName: 'John', lastName: 'Doe', emergencyContacts }),
                    }),
                ],
            });

            const family = PlatformFamily.create(blob, { platform: Platform.create({}), contextOrganization: organization });
            return family.members[0];
        }

        function getValue(member: PlatformMember) {
            const column = baseMemberColumns.find(c => 'id' in c && c.id === 'emergencyContacts') as XlsxTransformerConcreteColumn<PlatformMember> | undefined;

            if (!column) {
                throw new Error('Column emergencyContacts not found');
            }

            return column.getValue(member).value;
        }

        it('lists every emergency contact, also the ones without a numbered column', () => {
            const member = createMember([
                EmergencyContact.create({ name: 'An Peeters', title: 'Oma', phone: '0470 12 34 56' }),
                EmergencyContact.create({ name: 'Jan Janssens', title: 'Buur', phone: '0470 65 43 21' }),
                EmergencyContact.create({ name: 'Rita Maes', title: 'Tante', phone: '0470 11 22 33' }),
            ]);

            expect(getValue(member)).toBe('Oma: An Peeters (0470 12 34 56); Buur: Jan Janssens (0470 65 43 21); Tante: Rita Maes (0470 11 22 33)');
        });

        it('returns an empty value when the member has no emergency contacts', () => {
            expect(getValue(createMember([]))).toBe('');
        });
    });
});
