import { SimpleError } from '@simonbackx/simple-errors';
import type { Organization } from '@stamhoofd/models';
import type { Company, Organization as OrganizationStruct } from '@stamhoofd/structures';
import { VATExcemptReason } from '@stamhoofd/structures';

export class VATService {
    static getDefaultCompanyForOrganization(sellingOrganization: Organization | OrganizationStruct) {
        return sellingOrganization.meta.companies[0];
    }

    static isVATExcempt({ company, sellingOrganization }: { company: Company | null | undefined; sellingOrganization: Organization | OrganizationStruct}) {
        // Validate VAT rates for this customer
        const seller = this.getDefaultCompanyForOrganization(sellingOrganization)

        if (seller.VATNumber && seller.address && company) {
            // B2B validation
            if (!company.address) {
                throw new SimpleError({
                    code: 'missing_field',
                    message: 'Company address missing',
                    human: $t('%1LH'),
                    field: 'customer.company.address',
                });
            }

            // Reverse charged vat applicable?
            if (company.address.country !== seller.address.country && company.VATNumber && !company.VATNumber.trim().startsWith(seller.address.country)) {
                return true;
            }
        }

        return false
    }

    static getVATExcempt({ company, sellingOrganization, type }: { company: Company | null | undefined; sellingOrganization: Organization | OrganizationStruct; type: 'services'|'goods' }) {
        // Reverse charged vat applicable?
        if (this.isVATExcempt({company, sellingOrganization})) {
            if (type === 'services') {
                return VATExcemptReason.IntraCommunityServices;
            }
            return VATExcemptReason.IntraCommunityGoods;
        }

        return null
    }
}
