// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Group, Organization, User } from '@stamhoofd/models';
import { GroupFactory, Member, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationPeriod, Token, UserFactory } from '@stamhoofd/models';
import { appToUri, GroupCategory, GroupCategorySettings, PermissionLevel, Permissions, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { WorkerData } from '../helpers/index.js';

type Scenario = {
    organization: Organization;
    group: Group;
    user: User;
};

// Tagged @extra so it is excluded from the default (CI) run. Run it with: yarn stam test e2e --extra
test.describe('Import emergency contacts (organization mode) @import-emergency-contacts @extra', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario(seedId: string): Promise<Scenario> {
        const runId = `${WorkerData.id}-${seedId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Import Emergency Organization ${runId}`,
            uri: `import-emergency-organization-${runId}`,
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
            email: `import-emergency-admin-${runId}@test.be`,
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

        return importView;
    }

    test('imports the combined emergency contacts column, one contact per line', async ({ page }) => {
        test.setTimeout(90_000);
        const scenario = await seedScenario('happy');
        const { organization } = scenario;

        // Two new members. The first has a multi-line 'Alle noodcontacten' cell (quoted, exactly what the export
        // produces), the second a single contact without a title.
        const csv = [
            'ID,Voornaam,Achternaam,Alle noodcontacten',
            ',Nieuw,Lid1,"Oma: An Peeters (0470 12 34 56)\nBuur: Jan Janssens (0470 65 43 21)"',
            ',Nieuw,Lid2,An Peeters (0470 11 22 33)',
        ].join('\n');

        const importView = await openImportViewAndUpload({ page, scenario, csv });

        // The 'Alle noodcontacten' column (4th column) is matched automatically to the emergency contacts matcher
        await expect(importView.getByRole('combobox').nth(3)).toHaveValue('Alle noodcontacten-Lid');

        await importView.getByTestId('save-button').first().click();

        // These are new members without a group column, so skip registering them for a group
        await expect(page.getByRole('heading', { name: 'Importeer instellingen' })).toBeVisible();
        await page.getByText('Deze leden niet inschrijven voor een groep').click();
        await page.getByRole('button', { name: 'Importeer 2 leden' }).click();

        await expect(page.getByText('Importeren voltooid')).toBeVisible({ timeout: 30_000 });

        const members = await Member.select().where('organizationId', organization.id).fetch();
        expect(members).toHaveLength(2);

        // The multi-line cell became two separate emergency contacts, each split back into title, name and phone
        const member1 = members.find(m => m.details.firstName === 'Nieuw' && m.details.lastName === 'Lid1')!;
        expect(member1.details.emergencyContacts).toHaveLength(2);
        expect(member1.details.emergencyContacts[0].title).toBe('Oma');
        expect(member1.details.emergencyContacts[0].name).toBe('An Peeters');
        expect(member1.details.emergencyContacts[0].phone).toBe('0470 12 34 56');
        expect(member1.details.emergencyContacts[1].title).toBe('Buur');
        expect(member1.details.emergencyContacts[1].name).toBe('Jan Janssens');
        expect(member1.details.emergencyContacts[1].phone).toBe('0470 65 43 21');

        // A single contact without a title is imported as the name (the title cannot be recovered)
        const member2 = members.find(m => m.details.firstName === 'Nieuw' && m.details.lastName === 'Lid2')!;
        expect(member2.details.emergencyContacts).toHaveLength(1);
        expect(member2.details.emergencyContacts[0].title).toBe('');
        expect(member2.details.emergencyContacts[0].name).toBe('An Peeters');
        expect(member2.details.emergencyContacts[0].phone).toBe('0470 11 22 33');
    });
});
