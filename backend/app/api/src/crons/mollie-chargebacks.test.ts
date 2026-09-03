import { BalanceItemFactory, BalanceItemPayment, MolliePayment, Organization, OrganizationFactory, Payment, PaymentMandateChargebacks } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import { CreateMandateSettings } from '@stamhoofd/structures/checkout/CreateMandateSettings.js';
import { TestUtils } from '@stamhoofd/test-utils';
import type { MollieMockPayment } from '../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../tests/helpers/MollieMocker.js';
import { initMembershipOrganization } from '../../tests/init/initMembershipOrganization.js';
import { MollieService } from '../services/MollieService.js';
import { PaymentMandateService } from '../services/PaymentMandateService.js';
import { PaymentService } from '../services/PaymentService.js';
import { checkMollieChargebacksFor } from './mollie-chargebacks.js';

describe('Cron.mollie-chargebacks', () => {
    let mollieMocker: MollieMocker;
    let sellingOrganization: Organization;

    beforeAll(async () => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker = new MollieMocker();
        mollieMocker.start();

        sellingOrganization = await initMembershipOrganization();
        sellingOrganization.meta.registrationPaymentConfiguration.enableMandates = true;
        await sellingOrganization.save();
        await mollieMocker.setupToken(sellingOrganization);
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        TestUtils.setEnvironment('userMode', 'organization');
        mollieMocker.reset();
    });

    /**
     * Create a paying organization with saved Mollie mandates (two for the same card, one for another card)
     * and a succeeded recurring payment on the default mandate.
     */
    const init = async ({ withMandate = true }: { withMandate?: boolean } = {}) => {
        const payingOrganization = await new OrganizationFactory({}).create();
        const customerId = mollieMocker.createId('cst');
        mollieMocker.customers.push({ id: customerId });

        const mandate = mollieMocker.addMandate({ customerId, cardNumber: '1234' });
        const sameCardMandate = mollieMocker.addMandate({ customerId, cardNumber: '1234' });
        const otherMandate = mollieMocker.addMandate({ customerId, cardNumber: '9999' });

        payingOrganization.serverMeta.mollieCustomerId = customerId;
        payingOrganization.serverMeta.mollieMandateId = mandate.id;
        await payingOrganization.save();

        const price = 50_0000;
        const balanceItem = await new BalanceItemFactory({
            organizationId: sellingOrganization.id,
            payingOrganizationId: payingOrganization.id,
            amount: 1,
            unitPrice: price,
            pricePaid: price,
        }).create();

        const payment = new Payment();
        payment.organizationId = sellingOrganization.id;
        payment.payingOrganizationId = payingOrganization.id;
        payment.method = PaymentMethod.CreditCard;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = price;
        payment.paidAt = new Date();
        payment.mandateId = withMandate ? mandate.id : null;
        await payment.save();

        const balanceItemPayment = new BalanceItemPayment();
        balanceItemPayment.balanceItemId = balanceItem.id;
        balanceItemPayment.paymentId = payment.id;
        balanceItemPayment.organizationId = sellingOrganization.id;
        balanceItemPayment.price = price;
        await balanceItemPayment.save();

        const mockPayment: MollieMockPayment = {
            id: mollieMocker.createId('tr'),
            status: 'paid',
            amount: { currency: 'EUR', value: (Math.round(price / 100) / 100).toFixed(2) },
            internalPaymentId: payment.id,
            redirectUrl: null,
            sequenceType: withMandate ? 'recurring' : 'oneoff',
            customerId,
            mandateId: withMandate ? mandate.id : null,
            isCancelable: false,
            details: null,
        };
        mollieMocker.payments.push(mockPayment);

        const molliePayment = new MolliePayment();
        molliePayment.paymentId = payment.id;
        molliePayment.mollieId = mockPayment.id;
        await molliePayment.save();

        return { payingOrganization, payment, mockPayment, mandate, sameCardMandate, otherMandate };
    };

    const runCron = async () => {
        const service = await MollieService.create({ sellingOrganization });
        expect(service).not.toBeNull();
        await checkMollieChargebacksFor(service!, false);
    };

    const getMandates = async (payingOrganization: Organization) => {
        return await PaymentMandateService.getMandates({
            sellingOrganization,
            user: null,
            payingOrganization: (await Organization.getByID(payingOrganization.id))!,
        });
    };

    test('A chargeback blocks the mandate and other mandates of the same card', async () => {
        const { payingOrganization, payment, mockPayment, mandate, sameCardMandate, otherMandate } = await init();

        mollieMocker.createChargeback(mockPayment);
        await runCron();

        const chargebacks = await Payment.select().where('reversingPaymentId', payment.id).fetch();
        expect(chargebacks).toHaveLength(1);
        expect(chargebacks[0]).toMatchObject({
            type: PaymentType.Chargeback,
            status: PaymentStatus.Succeeded,
            price: -50_0000,
            mandateId: mandate.id,
        });

        const updated = (await Organization.getByID(payingOrganization.id))!;
        expect(updated.serverMeta.blockedMandates.map(b => b.id).sort()).toEqual([mandate.id, sameCardMandate.id].sort());
        expect(updated.serverMeta.blockedMandates[0].paymentId).toBe(chargebacks[0].id);

        // The default moves to the first usable mandate
        expect(updated.serverMeta.mollieMandateId).toBe(otherMandate.id);

        // The chargeback is counted on the mandate
        expect(updated.serverMeta.mandateChargebacks).toHaveLength(1);
        expect(updated.serverMeta.mandateChargebacks[0]).toMatchObject({ id: mandate.id, identifier: '1234/12/2030' });
        expect(updated.serverMeta.mandateChargebacks[0].dates).toHaveLength(1);

        const mandates = await getMandates(payingOrganization);
        expect(mandates.find(m => m.id === mandate.id)!.blockedAt).not.toBeNull();
        expect(mandates.find(m => m.id === sameCardMandate.id)!.blockedAt).not.toBeNull();
        expect(mandates.find(m => m.id === otherMandate.id)!.blockedAt).toBeNull();

        // Usable mandates are listed before blocked ones
        const grouped = PaymentMandateService.groupByMandate(mandates).mandates;
        expect(grouped).toHaveLength(2);
        expect(grouped[0].id).toBe(otherMandate.id);
        expect([mandate.id, sameCardMandate.id]).toContain(grouped[1].id);

        // Running the cron again does not register or block anything twice
        await runCron();
        expect(await Payment.select().where('reversingPaymentId', payment.id).fetch()).toHaveLength(1);
        expect((await Organization.getByID(payingOrganization.id))!.serverMeta.blockedMandates).toHaveLength(2);
    });

    test('Chargeback dates per mandate are limited to the last 12 months and at most 5', () => {
        const entry = PaymentMandateChargebacks.create({ id: 'mdt_test' });
        const now = new Date('2026-09-03T10:00:00.000Z');
        const day = 1000 * 60 * 60 * 24;

        entry.add(new Date(now.getTime() - 400 * day));
        entry.add(new Date(now.getTime() - 300 * day));
        expect(entry.dates).toHaveLength(2);

        for (let i = 0; i < 6; i++) {
            entry.add(new Date(now.getTime() - i * day));
        }

        // The oldest ones are dropped, the one older than a year too
        expect(entry.dates).toHaveLength(5);
        expect(entry.dates[0]).toEqual(now);
        expect(entry.dates[4]).toEqual(new Date(now.getTime() - 4 * day));
    });

    test('A blocked mandate can no longer be used to pay, nor can a new mandate for the same card', async () => {
        const { payingOrganization, mockPayment, mandate, otherMandate } = await init();

        mollieMocker.createChargeback(mockPayment);
        await runCron();

        // The same card is saved again after the block
        const newSameCardMandate = mollieMocker.addMandate({ customerId: payingOrganization.serverMeta.mollieCustomerId!, cardNumber: '1234' });

        const fresh = (await Organization.getByID(payingOrganization.id))!;
        expect(fresh.serverMeta.blockedMandates.map(b => b.id)).not.toContain(newSameCardMandate.id);

        const mandates = await getMandates(payingOrganization);
        expect(mandates.find(m => m.id === newSameCardMandate.id)!.blockedAt).not.toBeNull();

        const validate = (id: string) => PaymentService.validateMandate({
            method: PaymentMethod.Unknown,
            paymentConfiguration: sellingOrganization.meta.registrationPaymentConfiguration,
            mandate: mandates.find(m => m.id === id)!,
            payingOrganization: fresh,
            sellingOrganization,
            user: null,
        });

        await expect(validate(mandate.id)).rejects.toMatchObject({ code: 'mandate_blocked' });
        await expect(validate(newSameCardMandate.id)).rejects.toMatchObject({ code: 'mandate_blocked' });
        await expect(validate(otherMandate.id)).resolves.toMatchObject({ id: otherMandate.id });

        // The grouped list only offers the other card as usable
        const grouped = PaymentMandateService.groupByMandate(mandates).mandates;
        expect(grouped.filter(m => !m.isBlocked).map(m => m.id)).toEqual([otherMandate.id]);
    });

    test('Validating the same card again with a new payment unblocks all mandates for that card', async () => {
        const { payingOrganization, mockPayment, mandate, sameCardMandate, otherMandate } = await init();

        mollieMocker.createChargeback(mockPayment);
        await runCron();
        expect((await Organization.getByID(payingOrganization.id))!.serverMeta.blockedMandates).toHaveLength(2);

        // A new 'first' payment with the same card succeeds and creates a new mandate
        const newMandate = mollieMocker.addMandate({ customerId: payingOrganization.serverMeta.mollieCustomerId!, cardNumber: '1234' });
        const payment = new Payment();
        payment.organizationId = sellingOrganization.id;
        payment.payingOrganizationId = payingOrganization.id;
        payment.method = PaymentMethod.CreditCard;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Pending;
        payment.type = PaymentType.Payment;
        payment.price = 2_0000;
        payment.mandateId = newMandate.id;
        payment.createMandate = CreateMandateSettings.create({ saveAsDefault: false });
        await payment.save();

        await PaymentService.handlePaymentStatusUpdate(payment, sellingOrganization, PaymentStatus.Succeeded);

        expect((await Organization.getByID(payingOrganization.id))!.serverMeta.blockedMandates).toHaveLength(0);

        const mandates = await getMandates(payingOrganization);
        for (const id of [mandate.id, sameCardMandate.id, otherMandate.id, newMandate.id]) {
            expect(mandates.find(m => m.id === id)!.blockedAt).toBeNull();
        }
    });

    test('A chargeback of a payment without mandate does not block anything', async () => {
        const { payingOrganization, payment, mockPayment } = await init({ withMandate: false });

        mollieMocker.createChargeback(mockPayment);
        await runCron();

        expect(await Payment.select().where('reversingPaymentId', payment.id).fetch()).toHaveLength(1);
        expect((await Organization.getByID(payingOrganization.id))!.serverMeta.blockedMandates).toHaveLength(0);
    });
});
