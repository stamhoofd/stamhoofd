import { Migration } from '@simonbackx/simple-database';
import { ObjectData } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { logger } from '@simonbackx/simple-logging';
import { Organization, PayconiqPayment, WebshopCounter } from '@stamhoofd/models';
import { OrderStatus, PayconiqAccount } from '@stamhoofd/structures';


export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    let c = 0;
    let id: string = '';
    const limit = 100;

    await logger.setContext({ tags: ['seed'] }, async () => {
        while (true) {
            const organizations = await Organization.where({
                id: {
                    value: id,
                    sign: '>',
                },
            }, { limit, sort: ['id'] });

            if (organizations.length === 0) {
                break;
            }

            for (const organization of organizations) {
                if (organization.privateMeta.payconiqAccounts.length) {
                    c++;
                    console.log('Checking payconiq account ' + organization.privateMeta.payconiqAccounts[0].name);
                    try {
                        for (const account of organization.privateMeta.payconiqAccounts) {
                            await PayconiqPayment.forceLegacyRecheck(organization, account);
                            const payment = await PayconiqPayment.createTest(organization, account)
                            
                            if (!payment) {
                                throw new SimpleError({
                                    code: "invalid_field",
                                    message: "De API-key voor Payconiq is niet geldig. Kijk eens na of je wel de juiste key hebt ingevuld.",
                                    field: "payconiqAccounts"
                                })
                            }

                            // Save merchant id
                            const decoded = PayconiqAccount.decode(
                                new ObjectData({
                                    ...(payment as any).creditor,
                                    id: account.id,
                                    apiKey: account.apiKey,
                                }, {version: 0})
                            )

                            account.merchantId = decoded.merchantId
                            account.callbackUrl = decoded.callbackUrl
                            account.profileId = decoded.profileId
                            account.name = decoded.name
                            account.iban = decoded.iban
                            account.legacyApi = (organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production') ? false : (await PayconiqPayment.checkLegacyApi(account.apiKey));

                            if (account.legacyApi) {
                                console.log('Found legacy api')
                            }
                        }
                        await  organization.save();
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            if (organizations.length < limit) {
                break;
            }
            id = organizations[organizations.length - 1].id;
        }
    });

    console.log('Checked ' + c + ' keys');
});
