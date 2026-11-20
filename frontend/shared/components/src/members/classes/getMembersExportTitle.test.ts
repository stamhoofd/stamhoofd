import { Group, GroupSettings, Organization, OrganizationRegistrationPeriod, Platform, RegistrationPeriod, TranslatedString } from '@stamhoofd/structures';
import { expect, test } from 'vitest';
import { getMembersExportTitle } from './getMembersExportTitle';

const currentPeriod = RegistrationPeriod.create({ customName: 'Werkjaar 2026-2027' });
const platform = Platform.create({ period: currentPeriod });

function createOrganization(period: RegistrationPeriod) {
    return Organization.create({ name: 'Scouts Sint-Jan', period: OrganizationRegistrationPeriod.create({ period }) });
}

const group = Group.create({ settings: GroupSettings.create({ name: TranslatedString.create('Startavond 2025') }) });

test('names the export after the group', () => {
    const title = getMembersExportTitle({ organizations: [createOrganization(currentPeriod)], platform, categories: [], groups: [group], includeOrganizationName: false, suffix: 'Leden' });
    expect(title).toBe('Startavond 2025 - Leden');
});

test('adds the organization for platform admins and the period when it is not the current one', () => {
    const organization = createOrganization(RegistrationPeriod.create({ customName: 'Werkjaar 2025-2026' }));
    const title = getMembersExportTitle({ organizations: [organization], platform, categories: [], groups: [group], includeOrganizationName: true, suffix: 'Leden' });
    expect(title).toBe('Scouts Sint-Jan - Werkjaar 2025-2026 - Startavond 2025 - Leden');
});

test('names the export after the member when it contains a single member', () => {
    const title = getMembersExportTitle({ organizations: [], platform, categories: [], groups: [group], includeOrganizationName: false, suffix: 'Leden', singleMemberName: 'Jan Peeters' });
    expect(title).toBe('Jan Peeters');
});
