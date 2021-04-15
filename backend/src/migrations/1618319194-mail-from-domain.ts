import { Migration } from '@simonbackx/simple-database';
import { Organization } from '../models/Organization';

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }

    const organizations = await Organization.all();

    for (const organization of organizations) {
        // Undo default root groups
        if (organization.registerDomain) {
            organization.privateMeta.mailFromDomain = organization.registerDomain
            await organization.save()
        }
        
    }
});


