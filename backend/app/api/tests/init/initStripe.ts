import { Organization } from '@stamhoofd/models';
import { StripeMocker } from '../helpers/StripeMocker';
import { PaymentMethod } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';

export async function initStripe({ organization }: { organization: Organization }) {
    const stripeMocker = new StripeMocker();
    const stripeAccount = await stripeMocker.createStripeAccount(organization.id);

    stripeMocker.start();

    TestUtils.scheduleAfterThisTest(() => {
        stripeMocker.stop();
    });

    organization.meta.registrationPaymentConfiguration.paymentMethods.push(PaymentMethod.Bancontact, PaymentMethod.CreditCard, PaymentMethod.iDEAL);
    organization.privateMeta.registrationPaymentConfiguration.stripeAccountId = stripeAccount.id;
    await organization.save();

    return { stripeMocker, stripeAccount };
}
