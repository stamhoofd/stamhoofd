// test should always be imported first
import { test, setup } from '../test-fixtures/base.js';
setup();

// other imports
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SessionService } from '@stamhoofd/backend/services/SessionService';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Group, Organization, User } from '@stamhoofd/models';
import { GroupFactory, Member, MemberFactory, OrganizationFactory, OrganizationRegistrationPeriodFactory, RegistrationFactory, RegistrationPeriod, UserFactory } from '@stamhoofd/models';
import { Address, appToUri, BooleanStatus, GroupCategory, GroupCategorySettings, MemberDetails, OrganizationMetaData, OrganizationRecordsConfiguration, OrganizationType, Parent, ParentType, PermissionLevel, Permissions, PropertyFilter, STPackageBundle, Token as TokenStruct, TranslatedString, Version } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import { WorkerData } from '../helpers/index.js';

type Scenario = {
    organization: Organization;
    group: Group;
    user: User;
    /** Two siblings that share the same parents */
    memberA: Member;
    memberB: Member;
    portalUser: User;
    /** The shared parent, present on both siblings with the same id */
    motherId: string;
    fatherId: string;
    names: { memberA: string; memberB: string; mother: string; father: string; thirdParent: string };
};

const PORTAL_PASSWORD = 'testAbc123456';

// Valid Belgian national register numbers: the last two digits are the checksum 97 - (rest % 97)
const VALID_NRN_A = '93042000122';
const VALID_NRN_B = '93042000221';

// Members need a valid number of their own: the general step validates it, and it has to match the birth day
const YOUNG = { birthDay: new Date(2015, 3, 20), nationalRegisterNumber: '15042000162' };
const TOO_OLD = { birthDay: new Date(2008, 3, 20), nationalRegisterNumber: '08042000112' };
// Over 14, but a severe disability raises the limit to 21
const DISABLED = { birthDay: new Date(2007, 3, 20), nationalRegisterNumber: '07042000188', severeDisability: true };

test.describe('Tax dependent parents (organization mode) @tax-dependent', () => {
    test.beforeAll(() => {
        TestUtils.setPermanentEnvironment('userMode', 'organization');
    });

    test.afterEach(async () => {
        await WorkerData.resetDatabase();
    });

    async function seedScenario({ taxDependent, nationalRegisterNumbers, profile = YOUNG, taxDependentParents = {}, withThirdParent = false }: {
        taxDependent: boolean;
        /** National register number per parent, null to leave it empty */
        nationalRegisterNumbers: { mother: string | null; father: string | null };
        /** Young enough for a fiscal certificate, too old, or kept eligible by a severe disability */
        profile?: { birthDay: Date; nationalRegisterNumber: string; severeDisability?: boolean };
        /** Parents that already have the member tax dependent */
        taxDependentParents?: { mother?: boolean; father?: boolean };
        /** Adds a third parent, to reach the maximum of two tax dependent parents */
        withThirdParent?: boolean;
    }): Promise<Scenario> {
        const runId = `${WorkerData.id}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

        const organization = await new OrganizationFactory({
            name: `Tax Dependent Organization ${runId}`,
            uri: `tax-dependent-${runId}`,
            packages: [STPackageBundle.Members],
            meta: OrganizationMetaData.create({
                type: OrganizationType.Youth,
                umbrellaOrganization: null,
                defaultEndDate: new Date(),
                defaultStartDate: new Date(),
                defaultPrices: [],
                recordsConfiguration: OrganizationRecordsConfiguration.create({
                    parents: PropertyFilter.createDefault(),
                    birthDay: PropertyFilter.createDefault(),
                    nationalRegisterNumber: PropertyFilter.createDefault(),
                    taxDependent,
                }),
            }),
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
            period,
            name: new TranslatedString('Kapoenen'),
        }).create();

        const category = GroupCategory.create({
            settings: GroupCategorySettings.create({ name: 'Takken' }),
            groupIds: [group.id],
        });
        organizationPeriod.settings.categories.push(category);
        organizationPeriod.settings.rootCategory?.categoryIds.push(category.id);
        await organizationPeriod.save();

        const names = {
            memberA: `Anna-${runId}`,
            memberB: `Bram-${runId}`,
            mother: `Moeder-${runId}`,
            father: `Vader-${runId}`,
            thirdParent: `Plusouder-${runId}`,
        };

        // The same parent objects (same ids) on both siblings, like the backend merge produces
        // The member portal requires a phone, email and address on every parent
        const address = Address.create({
            street: 'Teststraat',
            number: '1',
            postalCode: '9000',
            city: 'Gent',
            country: Country.Belgium,
        });

        const mother = Parent.create({
            type: ParentType.Mother,
            firstName: names.mother,
            lastName: 'Doe',
            email: `moeder-${runId}@example.com`,
            phone: '+32470123456',
            address,
            taxDependent: taxDependentParents.mother ?? null,
            nationalRegisterNumber: nationalRegisterNumbers.mother,
        });
        const father = Parent.create({
            type: ParentType.Father,
            firstName: names.father,
            lastName: 'Doe',
            email: `vader-${runId}@example.com`,
            phone: '+32470123457',
            address,
            taxDependent: taxDependentParents.father ?? null,
            nationalRegisterNumber: nationalRegisterNumbers.father,
        });

        const thirdParent = Parent.create({
            type: ParentType.Other,
            firstName: names.thirdParent,
            lastName: 'Doe',
            email: `plusouder-${runId}@example.com`,
            phone: '+32470123458',
            address,
        });

        // Both members have to share a user: Member.getFamily joins on _members_users,
        // so without one they are not a family and the parent data never merges between them
        const portalUser = await new UserFactory({
            organization,
            email: `portal-${runId}@example.com`,
            password: PORTAL_PASSWORD,
        }).create();

        const buildMember = async (firstName: string) => {
            const member = await new MemberFactory({
                organization,
                user: portalUser,
                details: MemberDetails.create({
                    firstName,
                    lastName: 'Doe',
                    birthDay: profile.birthDay,
                    // Valid and complete, so the parents step is the one that needs work
                    nationalRegisterNumber: profile.nationalRegisterNumber,
                    severeDisability: profile.severeDisability === undefined ? null : BooleanStatus.create({ value: profile.severeDisability }),
                    parents: withThirdParent ? [mother.clone(), father.clone(), thirdParent.clone()] : [mother.clone(), father.clone()],
                }),
            }).create();

            // A registration in the current period keeps the member eligible for a fiscal certificate
            await new RegistrationFactory({ member, group }).create();
            return member;
        };

        const memberA = await buildMember(names.memberA);
        const memberB = await buildMember(names.memberB);

        const user = await new UserFactory({
            firstName: 'Tax',
            lastName: 'Admin',
            email: `tax-admin-${runId}@test.be`,
            organization,
            permissions: Permissions.create({ level: PermissionLevel.Full }),
        }).create();

        return { organization, group, user, memberA, memberB, motherId: mother.id, fatherId: father.id, names, portalUser };
    }

    async function loginAs({ page, user }: { page: Page; user: User }) {
        const token = await SessionService.createSession(user);
        const tokenString = JSON.stringify(new TokenStruct(token).encode({ version: Version }));
        const organizationId = user.organizationId;

        await page.addInitScript(({ organizationId, tokenString }) => {
            window.localStorage.setItem('token-' + organizationId, tokenString);
        }, { organizationId, tokenString });
    }

    /** Opens the members list, reloading the dashboard */
    async function openMembersList({ page, scenario }: { page: Page; scenario: Scenario }) {
        await page.goto(`${WorkerData.urls.dashboard}/${appToUri('dashboard')}/${scenario.organization.uri}`);

        const membersMenu = page.getByTestId('members-menu');
        await expect(membersMenu).toBeVisible({ timeout: 30_000 });

        // The full list lives behind 'Meer' in the members menu
        await membersMenu.locator('button.menu-button', { hasText: 'Meer' }).click();
        const allMembers = page.getByTestId('context-menu-item-title').filter({ hasText: 'Alle leden (alle werkjaren)' });
        await expect(allMembers).toBeVisible();
        await allMembers.click();

        await expect(page.getByTestId('table-row').first()).toBeVisible({ timeout: 30_000 });
    }

    /** Closes the member detail view that a table row opened, so the list is clickable again */
    async function closeMemberDetailView({ page }: { page: Page }) {
        const detail = page.locator('.member-segmented-view');

        if (await detail.first().isVisible().catch(() => false)) {
            await detail.first().getByTestId('close-button').first().click();
            await expect(detail.first()).toBeHidden({ timeout: 15_000 });
        }
    }

    /** Opens a member's edit view from the list that is already on screen, without reloading */
    async function openMemberEditViewFromList({ page, memberName }: { page: Page; memberName: string }) {
        const row = page.getByTestId('table-row').filter({ hasText: memberName });
        await expect(row).toBeVisible({ timeout: 30_000 });
        await row.click();

        await page.getByTestId('edit-member-button').click();

        const editView = page.getByTestId('member-step');
        await expect(editView).toBeVisible();
        return editView;
    }

    /** Opens the member's edit view, which contains the parents section */
    async function openMemberEditView({ page, scenario, memberName }: { page: Page; scenario: Scenario; memberName: string }) {
        await openMembersList({ page, scenario });
        return await openMemberEditViewFromList({ page, memberName });
    }

    async function openParentEditView({ page, editView, parentName }: { page: Page; editView: Locator; parentName: string }) {
        const row = editView.getByTestId('parent-row').filter({ hasText: parentName });
        await expect(row).toBeVisible();
        await row.getByTestId('edit-parent-button').click();

        const parentView = page.getByTestId('save-view').filter({ has: page.getByRole('heading', { name: new RegExp(parentName) }) });
        await expect(parentView).toBeVisible();
        return parentView;
    }

    function taxDependentCheckbox(parentView: Locator) {
        return parentView.getByTestId('tax-dependent-checkbox');
    }

    function nationalRegisterNumberInput(parentView: Locator) {
        // NRNInput forwards $attrs, so the testid lands on the wrapper as well as the input
        return parentView.locator('input[data-testid="national-register-number-input"]');
    }

    async function saveView(view: Locator) {
        await view.getByTestId('save-button').first().click();
    }

    /** Saves the parent popup and waits for it to close, so the view behind it is clickable again */
    async function saveParentView(parentView: Locator) {
        await saveView(parentView);

        try {
            await expect(parentView).toBeHidden({ timeout: 15_000 });
        } catch (error) {
            // A validation error keeps the popup open: report it instead of a bare timeout
            const messages = await parentView.locator('.error-box, .st-error-box').allInnerTexts().catch(() => []);
            throw new Error(`The parent view stayed open after saving. Validation errors: ${JSON.stringify(messages)}`);
        }
    }

    /** Saves the member step and waits for it to close, so the page underneath is usable again */
    async function saveMemberStep(step: Locator) {
        await saveView(step);
        await expect(step).toBeHidden({ timeout: 20_000 });
    }

    async function loginToPortal({ page, scenario }: { page: Page; scenario: Scenario }) {
        await page.goto(WorkerData.urls.registration(scenario.organization.uri) + '/leden');
        await page.getByTestId('open-login-button').click();
        await page.getByTestId('email-input').fill(scenario.portalUser.email);
        await page.getByTestId('password-input').fill(PORTAL_PASSWORD);
        await page.getByTestId('login-button').click();
        await expect(page.getByTestId('members-start-view')).toBeVisible({ timeout: 30_000 });
    }

    async function readTaxDependent(memberId: string, parentId: string) {
        const member = await Member.getByID(memberId);
        return member!.details.parents.find(p => p.id === parentId)?.taxDependent ?? null;
    }

    // ------------------------------------------------------------------
    // Only the national register number is enabled on the organization
    // ------------------------------------------------------------------

    test('with only NRN enabled, neither the tax dependent checkbox nor the NRN field is asked', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxDependent: false, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const parentView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        // The toggle is off, so we stop asking parents for a national register number entirely
        await expect(taxDependentCheckbox(parentView)).toBeHidden();
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();
    });

    test('with only NRN enabled, an already stored number stays visible so it can be corrected', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxDependent: false, nationalRegisterNumbers: { mother: VALID_NRN_A, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const motherView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        await expect(taxDependentCheckbox(motherView)).toBeHidden();
        await expect(nationalRegisterNumberInput(motherView)).toBeVisible();
        await expect(nationalRegisterNumberInput(motherView)).toHaveValue(/93\.04\.20-001\.22|93042000122/);
    });

    // ------------------------------------------------------------------
    // Both the national register number and tax dependency are enabled
    // ------------------------------------------------------------------

    test('with both enabled, the NRN field only appears once a parent is marked tax dependent', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxDependent: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const parentView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        await expect(taxDependentCheckbox(parentView)).toBeVisible();
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();

        await taxDependentCheckbox(parentView).click();
        await expect(nationalRegisterNumberInput(parentView)).toBeVisible();

        // And hides again when unticked
        await taxDependentCheckbox(parentView).click();
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();
    });

    test('nothing is asked when the member is too old for a fiscal certificate', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxDependent: true, nationalRegisterNumbers: { mother: null, father: null }, profile: TOO_OLD });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const parentView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        await expect(taxDependentCheckbox(parentView)).toBeHidden();
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();
    });

    test('a member over 14 with a severe disability is still asked', async ({ page }) => {
        test.setTimeout(120_000);
        const scenario = await seedScenario({ taxDependent: true, nationalRegisterNumbers: { mother: null, father: null }, profile: DISABLED });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const parentView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        // Same age as the TOO_OLD member, but the disability raises the limit to 21
        await expect(taxDependentCheckbox(parentView)).toBeVisible();
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();

        await taxDependentCheckbox(parentView).click();
        await expect(nationalRegisterNumberInput(parentView)).toBeVisible();
    });

    // ------------------------------------------------------------------
    // Tax dependency must stay per member, never copied to a sibling
    // ------------------------------------------------------------------

    test('marking a parent tax dependent for one child leaves the sibling untouched, also after a reload', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxDependent: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const parentView = await openParentEditView({ page, editView, parentName: scenario.names.mother });

        await taxDependentCheckbox(parentView).click();
        await nationalRegisterNumberInput(parentView).fill(VALID_NRN_A);
        await saveParentView(parentView);
        await saveMemberStep(editView);

        // The backend stores it for this member only
        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.motherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberB.id, scenario.motherId)).toBeNull();

        // The sibling shows it unticked in the state the frontend still holds, without reloading
        await closeMemberDetailView({ page });
        const liveSiblingEdit = await openMemberEditViewFromList({ page, memberName: scenario.names.memberB });
        const liveSiblingParentView = await openParentEditView({ page, editView: liveSiblingEdit, parentName: scenario.names.mother });

        await expect(taxDependentCheckbox(liveSiblingParentView)).not.toBeChecked();
        await expect(taxDependentCheckbox(liveSiblingParentView)).toBeVisible();

        // Close both views again without saving, so the reload starts from a clean state
        await liveSiblingParentView.getByTestId('close-button').first().click();
        await expect(liveSiblingParentView).toBeHidden({ timeout: 15_000 });
        await liveSiblingEdit.getByTestId('close-button').first().click();
        await expect(liveSiblingEdit).toBeHidden({ timeout: 15_000 });

        // And still unticked after a full reload, so the backend agrees with the frontend
        const siblingEdit = await openMemberEditView({ page, scenario, memberName: scenario.names.memberB });
        const siblingParentView = await openParentEditView({ page, editView: siblingEdit, parentName: scenario.names.mother });

        await expect(taxDependentCheckbox(siblingParentView)).not.toBeChecked();
        // The number itself is shared between the family members, so it stays visible for the sibling
        await expect(nationalRegisterNumberInput(siblingParentView)).toBeVisible();
    });

    test('each child can have a different parent tax dependent', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({ taxDependent: true, nationalRegisterNumbers: { mother: null, father: null } });
        await loginAs({ page, user: scenario.user });

        const editA = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const motherView = await openParentEditView({ page, editView: editA, parentName: scenario.names.mother });
        await taxDependentCheckbox(motherView).click();
        await nationalRegisterNumberInput(motherView).fill(VALID_NRN_A);
        await saveParentView(motherView);
        await saveMemberStep(editA);

        const editB = await openMemberEditView({ page, scenario, memberName: scenario.names.memberB });
        const fatherView = await openParentEditView({ page, editView: editB, parentName: scenario.names.father });
        await taxDependentCheckbox(fatherView).click();
        await nationalRegisterNumberInput(fatherView).fill(VALID_NRN_B);
        await saveParentView(fatherView);
        await saveMemberStep(editB);

        await expect.poll(async () => await readTaxDependent(scenario.memberB.id, scenario.fatherId), { timeout: 20_000 }).toBe(true);

        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
        expect(await readTaxDependent(scenario.memberA.id, scenario.fatherId)).toBeNull();
        expect(await readTaxDependent(scenario.memberB.id, scenario.motherId)).toBeNull();
    });

    // ------------------------------------------------------------------
    // Two tax dependent parents only make sense with fiscal co-parenting
    // ------------------------------------------------------------------

    test('marking a second parent asks to confirm fiscal co-parenting, and applies it when confirmed', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxDependent: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: null },
            taxDependentParents: { mother: true },
        });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const fatherView = await openParentEditView({ page, editView, parentName: scenario.names.father });

        await expect(taxDependentCheckbox(fatherView)).not.toBeChecked();
        await taxDependentCheckbox(fatherView).click();

        const confirm = page.getByTestId('centered-message');
        await expect(confirm).toBeVisible({ timeout: 15_000 });
        await expect(confirm.getByText(/co-ouderschap/i).first()).toBeVisible();

        // The first button confirms, the second cancels
        await confirm.getByTestId('centered-message-button').first().click();
        await expect(confirm).toBeHidden({ timeout: 15_000 });

        await expect(taxDependentCheckbox(fatherView)).toBeChecked();
        await nationalRegisterNumberInput(fatherView).fill(VALID_NRN_B);
        await saveParentView(fatherView);
        await saveMemberStep(editView);

        // Both parents are tax dependent now, which is what co-parenting means
        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.fatherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
    });

    test('cancelling the co-parenting confirmation leaves the second parent untouched', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxDependent: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: null },
            taxDependentParents: { mother: true },
        });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const fatherView = await openParentEditView({ page, editView, parentName: scenario.names.father });

        await taxDependentCheckbox(fatherView).click();

        const confirm = page.getByTestId('centered-message');
        await expect(confirm).toBeVisible({ timeout: 15_000 });

        // The second button cancels
        await confirm.getByTestId('centered-message-button').nth(1).click();
        await expect(confirm).toBeHidden({ timeout: 15_000 });

        // The checkbox springs back, and no national register number is asked
        await expect(taxDependentCheckbox(fatherView)).not.toBeChecked();
        await expect(nationalRegisterNumberInput(fatherView)).toBeHidden();

        await saveParentView(fatherView);
        await saveMemberStep(editView);

        expect(await readTaxDependent(scenario.memberA.id, scenario.fatherId)).toBeNull();
        expect(await readTaxDependent(scenario.memberA.id, scenario.motherId)).toBe(true);
    });

    test('a third parent cannot be marked tax dependent', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxDependent: true,
            nationalRegisterNumbers: { mother: VALID_NRN_A, father: VALID_NRN_B },
            taxDependentParents: { mother: true, father: true },
            withThirdParent: true,
        });
        await loginAs({ page, user: scenario.user });

        const editView = await openMemberEditView({ page, scenario, memberName: scenario.names.memberA });
        const thirdView = await openParentEditView({ page, editView, parentName: scenario.names.thirdParent });

        await taxDependentCheckbox(thirdView).click();

        // Blocked outright, not offered as a confirmation
        const message = page.getByTestId('centered-message');
        await expect(message).toBeVisible({ timeout: 15_000 });
        await expect(message.getByText(/maximaal twee ouders/i).first()).toBeVisible();
        await expect(message.getByText(/co-ouderschap\?/i)).toHaveCount(0);

        await message.getByTestId('centered-message-button').first().click();
        await expect(message).toBeHidden({ timeout: 15_000 });

        await expect(taxDependentCheckbox(thirdView)).not.toBeChecked();
    });

    // ------------------------------------------------------------------
    // Adding a new parent to the whole family
    // ------------------------------------------------------------------

    test('a new parent added to the whole family keeps tax dependency on the edited member only', async ({ page }) => {
        test.setTimeout(180_000);
        const scenario = await seedScenario({
            taxDependent: true,
            nationalRegisterNumbers: { mother: null, father: null },
        });

        // The portal is where a parent manages the whole family, so the siblings are loaded
        await loginToPortal({ page, scenario });

        const quickAction = page.getByTestId('quick-action').filter({ hasText: new RegExp(scenario.names.memberA) });
        await expect(quickAction).toBeVisible({ timeout: 30_000 });
        await quickAction.click();

        const step = page.getByTestId('member-step');
        await expect(step).toBeVisible();

        await step.getByTestId('add-parent-button').click();

        const newParentName = `Plusouder${Date.now()}`;
        const parentView = page.getByTestId('save-view').last();
        await parentView.locator('input[autocomplete="given-name"]').fill(newParentName);
        await parentView.locator('input[autocomplete="family-name"]').fill('Doe');
        await parentView.locator('input[type="tel"]').first().fill('+32498765432');
        await parentView.getByTestId('email-input').first().fill(`plusouder-${Date.now()}@example.com`);

        // Reuse the address the other parents already have
        await parentView.locator('.address-selection').first().click();

        await taxDependentCheckbox(parentView).click();
        await nationalRegisterNumberInput(parentView).fill(VALID_NRN_A);
        await saveView(parentView);

        // Confirm adding the parent to the other family member as well
        const confirm = page.getByTestId('centered-message');
        await expect(confirm).toBeVisible({ timeout: 15_000 });
        await confirm.getByTestId('centered-message-button').first().click();

        await expect(parentView).toBeHidden({ timeout: 15_000 });
        await saveMemberStep(step);

        await expect.poll(async () => {
            const member = await Member.getByID(scenario.memberA.id);
            return member!.details.parents.find(p => p.firstName === newParentName)?.taxDependent ?? null;
        }, { timeout: 30_000 }).toBe(true);

        // The sibling got the parent too, but never the tax dependency
        const sibling = await Member.getByID(scenario.memberB.id);
        const copied = sibling!.details.parents.find(p => p.firstName === newParentName);
        expect(copied).toBeDefined();
        expect(copied!.taxDependent).toBeNull();
    });

    // ------------------------------------------------------------------
    // Completing a missing national register number through the warning
    // ------------------------------------------------------------------

    test('the member portal asks to mark a parent tax dependent before the NRN can be added', async ({ page }) => {
        test.setTimeout(150_000);
        const scenario = await seedScenario({
            taxDependent: true,
            nationalRegisterNumbers: { mother: null, father: null },
        });

        await loginToPortal({ page, scenario });

        // The missing national register number surfaces as a quick action
        const quickAction = page.getByTestId('quick-action').filter({ hasText: new RegExp(scenario.names.memberA) });
        await expect(quickAction).toBeVisible({ timeout: 30_000 });
        await quickAction.click();

        const step = page.getByTestId('member-step');
        await expect(step).toBeVisible();

        // Saving without a tax dependent parent explains what to do first
        await saveView(step);
        await expect(step.getByText(/fiscaal ten laste/i).first()).toBeVisible();

        // Following that guidance resolves it
        const parentView = await openParentEditView({ page, editView: step, parentName: scenario.names.mother });
        await expect(nationalRegisterNumberInput(parentView)).toBeHidden();
        await taxDependentCheckbox(parentView).click();
        await expect(nationalRegisterNumberInput(parentView)).toBeVisible();
        await nationalRegisterNumberInput(parentView).fill(VALID_NRN_A);
        await saveParentView(parentView);
        await saveMemberStep(step);

        await expect.poll(async () => await readTaxDependent(scenario.memberA.id, scenario.motherId), { timeout: 20_000 }).toBe(true);
        expect(await readTaxDependent(scenario.memberB.id, scenario.motherId)).toBeNull();
    });
});
