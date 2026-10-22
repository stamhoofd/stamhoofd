import { Request } from '@simonbackx/simple-endpoints';
import type { XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { PlatformMember } from '@stamhoofd/structures';
import { EmergencyContact, Group, GroupPrice, GroupSettings, MemberDetails, MembersBlob, MemberWithRegistrationsBlob, Organization, OrganizationRegistrationPeriod, Platform, PlatformFamily, Registration, RegistrationPeriod } from '@stamhoofd/structures';
import { Language } from '@stamhoofd/types/Language';
import { ContextInstance } from '../helpers/Context.js';
import { getBaseMemberColumns } from './members.js';

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

        function getColumn() {
            const column = getBaseMemberColumns(Platform.create({})).find(c => 'id' in c && c.id === 'emergencyContacts') as XlsxTransformerConcreteColumn<PlatformMember> | undefined;

            if (!column) {
                throw new Error('Column emergencyContacts not found');
            }

            return column;
        }

        function getValue(member: PlatformMember) {
            return getColumn().getValue(member).value;
        }

        it('lists every emergency contact on its own line, also the ones without a numbered column', () => {
            const member = createMember([
                EmergencyContact.create({ name: 'An Peeters', title: 'Oma', phone: '0470 12 34 56' }),
                EmergencyContact.create({ name: 'Jan Janssens', title: 'Buur', phone: '0470 65 43 21' }),
                EmergencyContact.create({ name: 'Rita Maes', title: 'Tante', phone: '0470 11 22 33' }),
            ]);

            expect(getValue(member)).toBe('Oma: An Peeters (0470 12 34 56)\nBuur: Jan Janssens (0470 65 43 21)\nTante: Rita Maes (0470 11 22 33)');
        });

        it('wraps the text so every line stays visible', () => {
            const member = createMember([
                EmergencyContact.create({ name: 'An Peeters', title: 'Oma', phone: '0470 12 34 56' }),
            ]);

            expect(getColumn().getValue(member).style?.alignment?.wrapText).toBe(true);
        });

        it('returns an empty value when the member has no emergency contacts', () => {
            expect(getValue(createMember([]))).toBe('');
        });
    });

    describe('language column', () => {
        function createMember(language: Language | null) {
            const organization = Organization.create({});
            const blob = MembersBlob.create({
                organizations: [organization],
                members: [
                    MemberWithRegistrationsBlob.create({
                        details: MemberDetails.create({ firstName: 'John', lastName: 'Doe', language }),
                    }),
                ],
            });

            const family = PlatformFamily.create(blob, { platform: Platform.create({}), contextOrganization: organization });
            return family.members[0];
        }

        function getValue(member: PlatformMember) {
            const column = getBaseMemberColumns(Platform.create({})).find(c => 'id' in c && c.id === 'language') as XlsxTransformerConcreteColumn<PlatformMember> | undefined;

            if (!column) {
                throw new Error('Column language not found');
            }

            return column.getValue(member).value;
        }

        it('exports the name of the language', () => {
            expect(getValue(createMember(Language.French))).toBe($t('%13O'));
        });

        it('exports an empty value when the member uses the default language', () => {
            expect(getValue(createMember(null))).toBe('');
        });
    });

    describe('organization columns', () => {
        const period = RegistrationPeriod.create({ startDate: new Date('2025-09-01T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z') });
        const createOrganization = (name: string, uri: string) => Organization.create({ name, uri, period: OrganizationRegistrationPeriod.create({ period }) });
        const national = createOrganization('National', 'NAT');
        const groupA = createOrganization('Group A', 'A');
        const groupB = createOrganization('Group B', 'B');
        const platform = Platform.create({ period, membershipOrganizationId: national.id });

        function registration(organization: Organization, registeredAt: string) {
            return Registration.create({
                organizationId: organization.id,
                group: Group.create({ organizationId: organization.id, periodId: period.id, settings: GroupSettings.create({ period }) }),
                groupPrice: GroupPrice.create({}),
                registeredAt: new Date(registeredAt),
            });
        }

        function getValues(registrations: Registration[]) {
            const blob = MembersBlob.create({
                organizations: [national, groupA, groupB],
                members: [MemberWithRegistrationsBlob.create({ details: MemberDetails.create({}), registrations })],
            });
            const member = PlatformFamily.create(blob, { platform }).members[0];

            return Object.fromEntries(['organization', 'uri', 'organizations', 'uris'].map((id) => {
                const column = getBaseMemberColumns(platform).find(c => 'id' in c && c.id === id) as XlsxTransformerConcreteColumn<PlatformMember>;
                return [id, column.getValue(member).value];
            }));
        }

        it('exports one primary group and keeps all groups in separate columns', () => {
            expect(getValues([
                registration(national, '2025-10-15T00:00:00Z'),
                registration(groupA, '2025-09-15T00:00:00Z'),
                registration(groupB, '2025-10-01T00:00:00Z'),
            ])).toEqual({
                organization: 'Group B',
                uri: 'B',
                organizations: `Group A, Group B ${$t('%M1')} National`,
                uris: `A, B ${$t('%M1')} NAT`,
            });
        });

        it('exports a placeholder when the member has no group', async () => {
            const values = await ContextInstance.start(new Request({ method: 'GET', url: '/', host: '' }), async () => getValues([]));
            expect(values).toEqual({
                organization: $t('%5D'),
                uri: $t('%5D'),
                organizations: $t('%5D'),
                uris: $t('%5D'),
            });
        });
    });
});
