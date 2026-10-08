// test should always be imported first
import { setup, test } from '../test-fixtures/platform.js';
setup();

// other imports
import { expect } from '@playwright/test';
import { EmailMocker } from '@stamhoofd/email';
import type { User } from '@stamhoofd/models';
import { EmailTemplateFactory, Member, MemberFactory, Platform } from '@stamhoofd/models';
import { EmailTemplateType, MemberDetails, PropertyFilter } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/index.js';

EmailMocker.infect();

const securityCode = 'ABCD1234WXYZ5678';
const formattedCode = 'ABCD-1234-WXYZ-5678';
const memberEmail = 'lotte.beveiligd@example.com';

/**
 * A user adds a "new" member in the member portal that already exists (same name and birth day).
 * The portal then asks for the security code, which the user requests by email and enters.
 */
test.describe('Member portal - security code for an existing member @member-security-code', () => {
    let user: User;

    test.beforeAll(async () => {
        user = WorkerData.user;

        // The duplicate check needs a birth day, so the portal has to ask for it
        const platform = await Platform.getForEditing();
        platform.config.recordsConfiguration.birthDay = new PropertyFilter(null, {});
        await platform.save();

        await new EmailTemplateFactory({ type: EmailTemplateType.MemberSecurityCode }).create();
    });

    test.afterEach(async () => {
        await WorkerData.databaseHelper.clearMembers();
    });

    test('a user gets access to an existing member with the emailed security code', async ({ page, pages }) => {
        const existingMember = await new MemberFactory({
            firstName: 'Lotte',
            lastName: 'Beveiligd',
            birthDay: { year: 2012, month: 3, day: 14 },
            details: MemberDetails.create({
                email: memberEmail,
                securityCode,
            }),
        }).create();

        await test.step('add the same member as a new member', async () => {
            await pages.memberPortal.goto();
            await page.getByTestId('register-member-button').click();
            await page.getByTestId('new-member-button').click();

            await page.getByTestId('first-name-input').fill('Lotte');
            await page.getByTestId('last-name-input').fill('Beveiligd');
            await page.getByTestId('day-select').selectOption('14');
            await page.getByTestId('month-select').selectOption('3');
            await page.getByTestId('year-select').selectOption('2012');

            await page
                .getByTestId('member-step')
                .filter({ has: page.getByTestId('first-name-input') })
                .getByTestId('save-button')
                .click();
        });

        const codeStep = page.getByTestId('member-step').filter({ has: page.getByTestId('code-input') });
        await expect(codeStep).toBeVisible();

        await test.step('request the code by email', async () => {
            await codeStep.getByText('Stuur me de code via e-mail').click();
            await expect(page.getByTestId('toast-box')).toContainText('We stuurden de code via e-mail');

            const emails = await EmailMocker.getSucceededEmails();
            const email = emails.find(e => e.to.includes(memberEmail));
            expect(email).toBeDefined();
            expect(email!.text).toContain(formattedCode);
        });

        await test.step('enter the code and get access', async () => {
            // Submits automatically when complete
            await page.getByTestId('code-input').locator('input').fill(securityCode);
            await expect(page.getByTestId('toast-box')).toContainText('Je hebt succesvol toegang gekregen tot de gegevens van Lotte');
        });

        // The user is linked to the existing member instead of a duplicate being created
        const members = await Member.where({ firstName: 'Lotte', lastName: 'Beveiligd' });
        expect(members).toHaveLength(1);

        const [linkedMember] = await Member.getBlobByIds(existingMember.id);
        expect(linkedMember.users.map(u => u.id)).toContain(user.id);
    });
});
