// test should always be imported first
import { test, setup } from '../test-fixtures/organization.js';
setup();

// other imports
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { STPackageService } from '@stamhoofd/backend/tests/helpers';
import type { Member } from '@stamhoofd/models';
import { BalanceItem, BalanceItemFactory, BalanceItemPayment, CachedBalance, MemberFactory, Organization, Payment, STPackageFactory } from '@stamhoofd/models';
import { Company, PaymentCustomer, PaymentMethod, PaymentStatus, PaymentType, PermissionLevel, Permissions, STPackageBundle, UserPermissions } from '@stamhoofd/structures';
import { WorkerData } from '../helpers/index.js';

/**
 * Creating a manual invoice from the receivable balance view: the case where a payment and a
 * later refund (after the balance item price was lowered) can only be invoiced together.
 */
test.describe('Receivable balance invoices', () => {
    let organization: Organization;
    let member: Member;
    let memberName: string;

    const createPayment = async (options: { price: number; type: PaymentType; balanceItemId: string; customer: PaymentCustomer }) => {
        const payment = new Payment();
        payment.method = PaymentMethod.Transfer;
        payment.status = PaymentStatus.Succeeded;
        payment.type = options.type;
        payment.organizationId = organization.id;
        payment.price = options.price;
        payment.paidAt = new Date();
        payment.customer = options.customer;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = options.balanceItemId;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.price = options.price;
        balanceItemPayment.organizationId = organization.id;
        await balanceItemPayment.save();

        return payment;
    };

    test.beforeEach(async () => {
        const user = WorkerData.user;
        if (!user.organizationId) {
            throw new Error('User has no organization');
        }
        const foundOrganization = await Organization.getByID(user.organizationId);
        if (!foundOrganization) {
            throw new Error('Organization not found');
        }
        organization = foundOrganization;

        // Activate the members module, otherwise the dashboard only shows the onboarding view
        await new STPackageFactory({
            organization,
            bundle: STPackageBundle.Members,
        }).create();
        await STPackageService.updateOrganizationPackages(organization.id);
        await organization.refresh();

        // Enable invoicing and configure a seller company
        organization.meta.invoicesEnabled = true;
        if (organization.meta.companies.length === 0) {
            organization.meta.companies.push(Company.create({
                name: organization.name,
                address: organization.address,
            }));
        }
        await organization.save();

        // The receivable balances list requires finance permissions
        if (!user.permissions) {
            user.permissions = UserPermissions.create({});
        }
        user.permissions.organizationPermissions.set(
            organization.id,
            Permissions.create({ level: PermissionLevel.Full }),
        );
        await user.save();

        member = await new MemberFactory({ organization }).create();
        memberName = member.details.firstName + ' ' + member.details.lastName;

        // A balance item of 40 euro: 50 euro was paid, of which 20 euro was refunded (prices use 4 decimals)
        const balanceItem = await new BalanceItemFactory({
            organizationId: organization.id,
            memberId: member.id,
            amount: 1,
            unitPrice: 40_00_00,
            description: 'Kampinschrijving',
        }).create();

        // A VAT percentage is required to invoice a balance item
        balanceItem.VATPercentage = 0;
        await balanceItem.save();

        const customer = PaymentCustomer.create({
            firstName: 'Jan',
            lastName: 'Janssens',
            email: 'jan.janssens@voorbeeld.com',
        });

        await createPayment({ price: 50_00_00, type: PaymentType.Payment, balanceItemId: balanceItem.id, customer });
        await createPayment({ price: -20_00_00, type: PaymentType.Refund, balanceItemId: balanceItem.id, customer });

        await BalanceItem.updatePricePaid([balanceItem.id]);
        await CachedBalance.updateForMembers(organization.id, [member.id]);
    });

    test.afterEach(async () => {
        // Keep the worker organization/user (its auth token is reused), but clear balances, payments and invoices
        await WorkerData.databaseHelper.clearBilling();
        await WorkerData.databaseHelper.clearMembers();
    });

    async function gotoReceivableBalance(page: Page) {
        await page.goto(`${WorkerData.urls.dashboard}/beheerders/${organization.uri}`);
        await expect(page.getByTestId('app-name')).toBeVisible();

        // The finances tab can live under the "Meer" (More) menu in the tab bar
        const financesTab = page.getByRole('button', { name: 'Boekhouding', exact: false });
        if (!(await financesTab.first().isVisible().catch(() => false))) {
            await page.getByRole('button', { name: 'Meer', exact: false }).first().click();
        }
        await financesTab.first().click();

        await page.getByText('Te ontvangen bedragen').first().click();

        // Open the detail view of the member
        const row = page.getByTestId('table-row').filter({ hasText: memberName });
        await row.click();

        // Both payments are visible and not invoiced yet
        await expect(page.getByText('Nog niet gefactureerd')).toHaveCount(2);
    }

    function focusedPopup(page: Page) {
        return page.locator('div.popup.focused').last();
    }

    test('an admin can create one invoice for a payment and a refund together', async ({ page }) => {
        await gotoReceivableBalance(page);

        await test.step('select the payment and the refund to invoice', async () => {
            await page.getByRole('button', { name: 'Factuur opmaken' }).click();

            // Both payments are preselected in the popup (the native inputs are visually hidden)
            const popup = focusedPopup(page);
            const checkboxes = popup.locator('input[type="checkbox"]');
            await expect(checkboxes).toHaveCount(2);
            await expect(checkboxes.first()).toBeChecked();
            await expect(checkboxes.nth(1)).toBeChecked();

            // The total of the selection is the sum of both payments
            await expect(popup.getByText('Totaal te factureren')).toBeVisible();

            await popup.getByTestId('save-button').click();
        });

        await test.step('save the new invoice', async () => {
            const popup = focusedPopup(page);
            await expect(popup.getByRole('heading', { name: 'Nieuwe factuur maken' }).first()).toBeVisible();

            // One invoice is created for all selected payments together
            await expect(popup.getByText('Opgelet, er wordt slechts één factuur aangemaakt voor alle betalingen samen.')).toBeVisible();

            // The selection view is still in the navigation stack, so target the save button of this view
            await popup.getByRole('button', { name: 'Opslaan' }).click();
            await expect(page.getByText('Een nieuwe factuur werd aangemaakt')).toBeVisible();
        });

        await test.step('the invoice is listed and the payments are marked as invoiced', async () => {
            await expect(page.getByRole('heading', { name: 'Facturen' })).toBeVisible();
            await expect(page.getByText('Gefactureerd', { exact: true })).toHaveCount(2);
            await expect(page.getByText('Nog niet gefactureerd')).toHaveCount(0);
        });
    });
});
