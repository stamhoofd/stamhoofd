import { PaymentMethod } from '@stamhoofd/structures';
import { PayconiqMocker } from '../helpers/PayconiqMocker';
import { Organization } from '@stamhoofd/models';

export async function initPayconiq({ organization }: { organization: Organization }) {
    organization.meta.registrationPaymentConfiguration.paymentMethods.push(PaymentMethod.Payconiq);
    organization.privateMeta.payconiqAccounts = [PayconiqMocker.generateTestAccount()];
    await organization.save();
}
