import { Migration } from '@simonbackx/simple-database';


export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    // console.log("Creating Stripe Invoices...")
    // if (!STAMHOOFD.STRIPE_SECRET_KEY) {
    //     console.log("No stripe key set")
    //     return
    // }
    // 
    // const invoicer = new StripeInvoicer({
    //     secretKey: STAMHOOFD.STRIPE_SECRET_KEY,
    // })
    // await invoicer.generateAllInvoices({force: true, start: new Date(2022, 12 - 1, 1)})
});


