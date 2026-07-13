// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Group, Organization, User } from '@stamhoofd/models';
import { GroupFactory, Member, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, Registration, RegistrationPeriod, RegistrationFactory, Token, UserFactory } from '@stamhoofd/models';
import { appToUri, GroupCategory, GroupCategorySettings, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { randomUUID } from 'node:crypto';
import { WorkerData } from '../helpers/index.js';

type Scenario = {
    organization: Organization;
    group: Group;
    user: User;
};

test.describe('Import members with an ID column (organization mode) @import-members', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario(seedId: string): Promise<Scenario> {
        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Import Organization ${runId}`,
            uri: `import-organization-${runId}`,
            packages: [STPackageBundle.Members],
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);

        const period = await RegistrationPeriod.getByID(organization.periodId);
        if (!period) {
            throw new Error('Missing registration period for organization');
        }

        const organizationPeriod = await new OrganizationRegistrationPeriodFactory({
            organization,
            period,
        }).create();

        const group = await new GroupFactory({
            organization,
            name: new TranslatedString('Kapoenen'),
        }).create();

        // The group must be part of a category to show up in the period groups
        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [group.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        const user = await new UserFactory({
            firstName: 'Import',
            lastName: 'Admin',
            email: `import-admin-${runId}@test.be`,
            organization,
            permissions: Permissions.create({
                level: PermissionLevel.Full,
            }),
        }).create();

        return { organization, group, user };
    }

    async function loginAs({ page, user }: { page: Page; user: User }) {
        const token = await Token.createToken(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));

        const organizationId = user.organizationId;
        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }

    async function openImportViewAndUpload({ page, scenario, csv }: { page: Page; scenario: Scenario; csv: string }) {
        await loginAs({ page, user: scenario.user });
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        // The members settings view is the default view of the members tab in organization mode
        await page.getByText('Leden importeren').first().click();

        const importView = page.getByTestId('save-view').filter({ has: page.getByRole('heading', { name: 'Leden importeren' }) });
        await importView.locator('input[type="file"]').setInputFiles({
            name: 'leden.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csv, 'utf-8'),
        });

        // Wait until the columns are matched (the ID column should be matched automatically)
        await expect(importView.getByRole('combobox').first()).toHaveValue('MemberIdColumnMatcher');

        await importView.getByTestId('save-button').first().click();
    }

    test('members with an id are only matched on id, members without an id can be created', async ({ page }) => {
        test.setTimeout(90_000);
        const scenario = await seedScenario('happy');
        const { organization, group } = scenario;

        // Existing member with a registration. The name in the file is different,
        // so it can only be matched on its id.
        const memberWithRegistration = await new MemberFactory({
            organization,
            firstName: 'Origineel',
            lastName: 'MetInschrijving',
        }).create();
        await new RegistrationFactory({
            member: memberWithRegistration,
            group,
        }).create();

        // Existing member without any registrations: can only be found via its id
        const memberWithoutRegistrations = await new MemberFactory({
            organization,
            firstName: 'Bestaand',
            lastName: 'ZonderInschrijving',
        }).create();

        const csv = [
            'ID,Voornaam,Achternaam',
            `${memberWithRegistration.id},Aangepast,MetInschrijving`,
            `${memberWithoutRegistrations.id},Bestaand,ZonderInschrijving`,
            ',Nieuw,Lid',
        ].join('\n');

        await openImportViewAndUpload({ page, scenario, csv });

        // The import settings: 2 of the 3 members already exist
        await expect(page.getByRole('heading', { name: 'Importeer instellingen' })).toBeVisible();
        await page.getByRole('button', { name: 'Importeer 3 leden' }).click();

        await expect(page.getByText('Importeren voltooid')).toBeVisible({ timeout: 30_000 });

        // No new members were created for the rows with an id
        const members = await Member.select().where('organizationId', organization.id).fetch();
        expect(members).toHaveLength(3);

        // The member with a registration was updated, not duplicated
        const updatedMember = members.find(m => m.id === memberWithRegistration.id)!;
        expect(updatedMember.details.firstName).toBe('Aangepast');

        // The member without registrations was matched and registered
        const registrations = await Registration.select().where('memberId', memberWithoutRegistrations.id).fetch();
        expect(registrations).toHaveLength(1);
        expect(registrations[0].groupId).toBe(group.id);

        // The row without an id created a new member
        const newMember = members.find(m => m.id !== memberWithRegistration.id && m.id !== memberWithoutRegistrations.id)!;
        expect(newMember.details.firstName).toBe('Nieuw');
        expect(newMember.details.lastName).toBe('Lid');
    });

    test('new members can be imported without registering them for a group', async ({ page }) => {
        test.setTimeout(90_000);
        const scenario = await seedScenario('skip-group');
        const { organization } = scenario;

        // Two new members without an id and without a group column: they need a group assignment
        const csv = [
            'ID,Voornaam,Achternaam',
            ',Nieuw,Lid1',
            ',Nieuw,Lid2',
        ].join('\n');

        await openImportViewAndUpload({ page, scenario, csv });

        await expect(page.getByRole('heading', { name: 'Importeer instellingen' })).toBeVisible();

        // Choose not to register these members for a group
        await page.getByText('Deze leden niet inschrijven voor een groep').click();

        // A warning explains the new members will be created but not registered
        await expect(page.getByText('moeilijk terug te vinden in het systeem')).toBeVisible();

        await page.getByRole('button', { name: 'Importeer 2 leden' }).click();

        await expect(page.getByText('Importeren voltooid')).toBeVisible({ timeout: 30_000 });

        // Both members were created
        const members = await Member.select().where('organizationId', organization.id).fetch();
        expect(members).toHaveLength(2);

        // ...but no registrations were created for them
        for (const member of members) {
            const registrations = await Registration.select().where('memberId', member.id).fetch();
            expect(registrations).toHaveLength(0);
        }
    });

    test('an unknown id is a hard error and blocks the import', async ({ page }) => {
        const scenario = await seedScenario('unknown-id');
        const { organization, group } = scenario;

        const existingMember = await new MemberFactory({
            organization,
            firstName: 'Bestaand',
            lastName: 'Lid',
        }).create();
        await new RegistrationFactory({
            member: existingMember,
            group,
        }).create();

        const csv = [
            'ID,Voornaam,Achternaam',
            `${existingMember.id},Bestaand,Lid`,
            `${randomUUID()},Onbekend,Lid`,
            ',Nieuw,Lid',
        ].join('\n');

        await openImportViewAndUpload({ page, scenario, csv });

        // A row with an unknown id can never create a new member
        await expect(page.getByRole('heading', { name: 'Kijk deze fouten na' }).first()).toBeVisible();
        await expect(page.getByText('Er bestaat geen lid met het ID').first()).toBeVisible();

        // Nothing was imported
        const members = await Member.select().where('organizationId', organization.id).fetch();
        expect(members).toHaveLength(1);
    });
});
