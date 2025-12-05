import { field, StringDecoder } from '@simonbackx/simple-encoding';
import { StringCompare } from '@stamhoofd/utility';

import { Settlement } from '../members/Payment.js';
import { OrganizationSimple } from '../OrganizationSimple.js';
import { STInvoice } from './STInvoice.js';

export class STInvoicePrivate extends STInvoice {
    @field({ decoder: OrganizationSimple, optional: true })
    organization?: OrganizationSimple;

    @field({ decoder: Settlement, nullable: true })
    settlement: Settlement | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 186 })
    reference: string | null = null;

    matchQuery(query: string) {
        if (query === this.number?.toString() || query === this.id) {
            return true;
        }

        if (
            StringCompare.contains(this.meta.companyName, query)
            || StringCompare.typoCount(this.meta.companyAddress.city, query) < 2
            || StringCompare.contains(this.meta.companyContact, query)
            || (this.meta.companyVATNumber && StringCompare.typoCount(this.meta.companyVATNumber, query) < 2)
            || StringCompare.typoCount(this.meta.companyAddress.street, query) < 2
        ) {
            return true;
        }

        if (!this.organization) {
            return false;
        }

        if (
            StringCompare.typoCount(this.organization.name, query) < 2
            || StringCompare.typoCount(this.organization.address.city, query) < 2
            || StringCompare.typoCount(this.organization.address.street, query) < 2
            || StringCompare.typoCount(this.meta.companyName, query) < 2
            || StringCompare.typoCount(this.meta.companyName, query) < 2
        ) {
            return true;
        }
        return false;
    }
}
