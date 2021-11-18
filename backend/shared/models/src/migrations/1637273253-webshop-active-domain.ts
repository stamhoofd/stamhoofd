import { Migration } from '@simonbackx/simple-database';
import { WebshopPrivateMetaData } from '@stamhoofd/structures';
import { Organization } from '../models/Organization';
import { Webshop } from '../models/Webshop';

export default new Migration(async () => {
    if (STAMHOOFD.environment == "test") {
        console.log("skipped in tests")
        return;
    }

    const webshops = await Webshop.where({ 
        domain: {
            value: null,
            sign: "!="
        }}
    );

    for (const webshop of webshops) {
        if (webshop.domain) {
            const cleaned = webshop.domain.toLowerCase().replace(/[^a-zA-Z0-9-.]/g, '');
            webshop.domain = cleaned;
            webshop.meta.domainActive = false
            webshop.privateMeta.dnsRecords = WebshopPrivateMetaData.buildDNSRecords(cleaned)
            await webshop.updateDNSRecords(false) // not in background, because we don't want to send e-mails now
            await webshop.save()
        }
    }
});


