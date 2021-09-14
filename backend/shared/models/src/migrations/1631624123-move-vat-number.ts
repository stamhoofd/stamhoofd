import { Migration } from '@simonbackx/simple-database';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        if (organization.privateMeta.VATNumber) {
            organization.meta.VATNumber = organization.privateMeta.VATNumber
            organization.meta.companyNumber = organization.privateMeta.VATNumber
            await organization.save()
        }
    }
});


