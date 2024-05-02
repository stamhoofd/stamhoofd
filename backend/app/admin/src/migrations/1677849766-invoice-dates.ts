import { Migration } from '@simonbackx/simple-database';
import { STInvoice } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const invoices = await STInvoice.all();

    for (const invoice of invoices) {
        invoice.meta.date = invoice.paidAt ?? invoice.createdAt;
        await invoice.save();
    }
});


