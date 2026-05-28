import type { Organization } from '@stamhoofd/models';
import { BalanceItem } from '@stamhoofd/models';
import type { Company, Organization as OrganizationStruct } from '@stamhoofd/structures';
import { BalanceItemStatus, getBalanceItemTypeVATType, VATExcemptReason } from '@stamhoofd/structures';

export class VATService {
    static getDefaultCompanyForOrganization(sellingOrganization: Organization | OrganizationStruct): Company {
        return sellingOrganization.defaultCompanies[0];
    }

    static async updateVATExcempt({ organization, sellingOrganization }: { organization: Organization; sellingOrganization: Organization | OrganizationStruct }) {
        const company = organization.defaultCompanies[0];
        const exempt = this.isVATExcempt({ company, sellingOrganization });
        console.log('updating VAT excempt', exempt);

        if (exempt) {
            const items = await BalanceItem.select()
                .where('organizationId', sellingOrganization.id)
                .where('payingOrganizationId', organization.id)
                .whereNot('status', BalanceItemStatus.Hidden)
                .whereNot('priceOpen', 0)
                .where('priceInvoiced', 0)
                .where('VATExcempt', null)
                .fetch();

            for (const item of items) {
                if (!item.VATExcempt) {
                    const type = getBalanceItemTypeVATType(item.type);
                    if (type) {
                        item.VATExcempt = this.getVATExcemptType({ type });
                        await item.save();
                    }
                }
            }
        } else {
            const items = await BalanceItem.select()
                .where('organizationId', sellingOrganization.id)
                .where('payingOrganizationId', organization.id)
                .whereNot('status', BalanceItemStatus.Hidden)
                .whereNot('priceOpen', 0)
                .where('priceInvoiced', 0)
                .whereNot('VATExcempt', null)
                .fetch();

            for (const item of items) {
                if (item.VATExcempt) {
                    item.VATExcempt = null;
                    await item.save();
                }
            }
        }
    }

    static isVATExcempt({ company, sellingOrganization }: { company: Company | null | undefined; sellingOrganization: Organization | OrganizationStruct }) {
        // Validate VAT rates for this customer
        const seller = this.getDefaultCompanyForOrganization(sellingOrganization);

        if (seller.VATNumber && seller.address && company) {
            // B2B validation
            // No address -> we guess the same country as the seller (least risk of not applying VAT when it is required)
            // Reverse charged vat applicable?
            if ((company.address && company.address.country !== seller.address.country) && company.VATNumber && !company.VATNumber.trim().startsWith(seller.address.country)) {
                return true;
            }
        }

        return false;
    }

    static getVATExcemptType({ type }: { type: 'services' | 'goods' }) {
        if (type === 'services') {
            return VATExcemptReason.IntraCommunityServices;
        }
        return VATExcemptReason.IntraCommunityGoods;
    }

    static getVATExcempt({ company, sellingOrganization, type }: { company: Company | null | undefined; sellingOrganization: Organization | OrganizationStruct; type: 'services' | 'goods' }) {
        // Reverse charged vat applicable?
        if (this.isVATExcempt({ company, sellingOrganization })) {
            return this.getVATExcemptType({ type });
        }

        return null;
    }
}
