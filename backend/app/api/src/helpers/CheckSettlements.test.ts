import { MolliePayment, OrganizationFactory, Payment } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, PaymentStatus, PaymentType } from '@stamhoofd/structures';
import type { MollieMockPayment, MollieMockRefund } from '../../tests/helpers/MollieMocker.js';
import { MollieMocker } from '../../tests/helpers/MollieMocker.js';
import { checkMollieSettlementsFor } from './CheckSettlements.js';

describe('Helper.CheckSettlements', () => {
    let mollieMocker: MollieMocker;

    beforeAll(() => {
        mollieMocker = new MollieMocker();
        mollieMocker.start();
    });

    afterAll(() => {
        mollieMocker.stop();
    });

    beforeEach(() => {
        mollieMocker.reset();
    });

    /**
     * Create an organization with a Mollie token, a succeeded Mollie payment and a Mollie refund
     * payment reversing it. Both are linked to their Mollie ids (tr_... / re_...) like the real crons do.
     */
    const init = async () => {
        const organization = await new OrganizationFactory({}).create();
        const token = await mollieMocker.setupToken(organization);

        // Source payment
        const payment = new Payment();
        payment.organizationId = organization.id;
        payment.method = PaymentMethod.Bancontact;
        payment.provider = PaymentProvider.Mollie;
        payment.status = PaymentStatus.Succeeded;
        payment.type = PaymentType.Payment;
        payment.price = 50_0000;
        payment.paidAt = new Date();
        await payment.save();

        const mockPayment: MollieMockPayment = {
            id: mollieMocker.createId('tr'),
            status: 'paid',
            amount: { currency: 'EUR', value: '50.00' },
            internalPaymentId: payment.id,
            redirectUrl: null,
            sequenceType: 'oneoff',
            customerId: null,
            mandateId: null,
            isCancelable: false,
            details: null,
        };
        mollieMocker.payments.push(mockPayment);

        const paymentLink = new MolliePayment();
        paymentLink.paymentId = payment.id;
        paymentLink.mollieId = mockPayment.id;
        await paymentLink.save();

        // Refund payment reversing the source payment
        const refundPayment = new Payment();
        refundPayment.organizationId = organization.id;
        refundPayment.method = PaymentMethod.Bancontact;
        refundPayment.provider = PaymentProvider.Mollie;
        refundPayment.status = PaymentStatus.Succeeded;
        refundPayment.type = PaymentType.Refund;
        refundPayment.price = -20_0000;
        refundPayment.reversingPaymentId = payment.id;
        refundPayment.paidAt = new Date();
        await refundPayment.save();

        const mockRefund = mollieMocker.createRefund(mockPayment, { value: '20.00', status: 'refunded' });

        const refundLink = new MolliePayment();
        refundLink.paymentId = refundPayment.id;
        refundLink.mollieId = mockRefund.id;
        await refundLink.save();

        return { organization, token, payment, refundPayment, mockPayment, mockRefund };
    };

    const runCron = async (token: { accessToken: string }) => {
        await checkMollieSettlementsFor(token.accessToken, true);
    };

    /**
     * Add a Mollie chargeback payment reversing the given source payment, linked to its Mollie
     * chargeback id (chb_...) like the mollie-chargebacks cron does.
     */
    const addChargeback = async (organizationId: string, sourcePayment: Payment, mockPayment: MollieMockPayment) => {
        const chargebackPayment = new Payment();
        chargebackPayment.organizationId = organizationId;
        chargebackPayment.method = PaymentMethod.Bancontact;
        chargebackPayment.provider = PaymentProvider.Mollie;
        chargebackPayment.status = PaymentStatus.Succeeded;
        chargebackPayment.type = PaymentType.Chargeback;
        chargebackPayment.price = -sourcePayment.price;
        chargebackPayment.reversingPaymentId = sourcePayment.id;
        chargebackPayment.paidAt = new Date();
        await chargebackPayment.save();

        const mockChargeback = mollieMocker.createChargeback(mockPayment);

        const chargebackLink = new MolliePayment();
        chargebackLink.paymentId = chargebackPayment.id;
        chargebackLink.mollieId = mockChargeback.id;
        await chargebackLink.save();

        return { chargebackPayment, mockChargeback };
    };

    test('The settlement of a refund settled at Mollie is stored on the refund payment', async () => {
        const { token, payment, refundPayment, mockPayment, mockRefund } = await init();

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            refunds: [mockRefund],
            value: '100.00',
        });

        await runCron(token);

        // The source payment gets the settlement metadata (existing behaviour)
        const updatedPayment = await Payment.getByID(payment.id);
        expect(updatedPayment!.settlement).toMatchObject({
            id: settlement.id,
            reference: settlement.reference,
        });

        // The refund payment gets the same settlement metadata (new behaviour)
        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toMatchObject({
            id: settlement.id,
            reference: settlement.reference,
            amount: 100_0000,
        });
    });

    test('A refund that is not part of any settlement keeps no settlement', async () => {
        const { token, refundPayment, mockPayment } = await init();

        // A settlement that only contains the source payment, not the refund
        mollieMocker.createSettlement({ payments: [mockPayment], value: '50.00' });

        await runCron(token);

        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toBeNull();
    });

    test('The settlement of a chargeback settled at Mollie is stored on the chargeback payment', async () => {
        const { organization, token, payment, mockPayment } = await init();
        const { chargebackPayment, mockChargeback } = await addChargeback(organization.id, payment, mockPayment);

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            chargebacks: [mockChargeback],
            value: '100.00',
        });

        await runCron(token);

        const updatedChargeback = await Payment.getByID(chargebackPayment.id);
        expect(updatedChargeback!.settlement).toMatchObject({
            id: settlement.id,
            reference: settlement.reference,
            amount: 100_0000,
        });
    });

    test('An unlinked refund entry in a settlement is skipped without affecting the known refund', async () => {
        const { token, refundPayment, mockPayment, mockRefund } = await init();

        // A refund that belongs to a different system: it exists at Mollie but has no MolliePayment link
        const unlinkedRefund: MollieMockRefund = mollieMocker.createRefund(mockPayment, { value: '5.00', status: 'refunded' });

        const settlement = mollieMocker.createSettlement({
            payments: [mockPayment],
            refunds: [unlinkedRefund, mockRefund],
            value: '100.00',
        });

        await runCron(token);

        // The known refund still gets its settlement, the unlinked one is silently ignored
        const updatedRefund = await Payment.getByID(refundPayment.id);
        expect(updatedRefund!.settlement).toMatchObject({ id: settlement.id });
    });
});
