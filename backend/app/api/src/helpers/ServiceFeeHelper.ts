import { SimpleError } from '@simonbackx/simple-errors';
import type { Payment, StripeAccount } from '@stamhoofd/models';
import { Organization, Platform } from '@stamhoofd/models';
import { PaymentMethod, PaymentProvider, STPackageType } from '@stamhoofd/structures';
import { VATService } from '../services/VATService.js';
import { STMath } from '@stamhoofd/utility';

const CACHE_TIMEOUT = 1000 * 60 * 5; // 5 minutes

export class ServiceFeeHelper {
    static #cachedOrganization: Organization | null = null;
    static #cachedOrganizationDate: Date | null = null;

    /**
     * Organization that is invoicing
     */
    static async getInvoicingOrganization() {
        if (this.#cachedOrganization && this.#cachedOrganizationDate && this.#cachedOrganizationDate > new Date(Date.now() - CACHE_TIMEOUT)) {
            return this.#cachedOrganization;
        }
        const platform = await Platform.getShared();
        const membershipId = platform.membershipOrganizationId;
        if (!membershipId) {
            return null;
        }

        const org = await Organization.getByID(membershipId, true);
        this.#cachedOrganization = org;
        this.#cachedOrganizationDate = new Date();

        return org;
    }

    /**
     * VAT rate used to charge service fees or transfer fees to organization by the invoicing organization (membershipOrganizationId)
     */
    static async getVATPercentage(organization: Organization) {
        const invoicingOrganization = await this.getInvoicingOrganization();
        if (!invoicingOrganization) {
            throw new SimpleError({
                code: 'unavailable',
                message: 'Payments are temporarily unavailable due to a lack of VAT settings',
                human: $t('Online betalingen zijn tijdelijk onbeschikbaar op het platform door een probleem met de berekening van BTW-tarieven op kosten.'),
            });
        }

        const customer = organization.defaultCompanies[0];

        if (VATService.isVATExcempt({
            sellingOrganization: invoicingOrganization,
            company: customer,
        })) {
            return 0;
        }

        return 21;
    }

    static async setServiceFee(payment: Payment, organization: Organization, type: 'webshop' | 'members' | 'tickets' | 'system', itemPrices: number[]): Promise<void> {
        if (type === 'system') {
            return;
        }

        function calculateFee(price: number, minimumFee: number | null, maximumFee: number | null, fixed: number, percentageTimes100: number) {
            if (price === 0 && !minimumFee) {
                return 0;
            }
            let fee = Math.round((fixed + Math.max(100, price * percentageTimes100 / 100 / 100)) / 100) * 100; // Round to 2 decimals, minimum 1 cent
            if (minimumFee !== null && fee < minimumFee) {
                fee = minimumFee;
            }
            if (maximumFee !== null && fee > maximumFee) {
                fee = maximumFee;
            }
            return fee;
        }

        let serviceFee = 0;

        // Calculate service fee if organization has a package with service fees
        if (organization) {
            const packageStatus = type === 'webshop' || type === 'tickets' ? organization.meta.packages.packages.get(STPackageType.Webshops) : organization.meta.packages.packages.get(STPackageType.Members);
            const fees = packageStatus?.activeServiceFees;

            console.log('Service fee settings for payment', payment.id, type, 'are', fees);

            if (fees && (fees.fixed > 0 || fees.percentage > 0)) {
                serviceFee = itemPrices.reduce((total, price) => {
                    return total + calculateFee(
                        price,
                        fees.minimum,
                        fees.maximum,
                        fees.fixed,
                        fees.percentage,
                    );
                }, 0);
            }
        }

        // Add VAT
        if (serviceFee !== 0) {
            let vat = 0;

            // Calculate item count
            if (payment.provider === PaymentProvider.Stripe && payment.stripeAccountId) {
                // Don't chagne
                vat = await this.getVATPercentage(organization);
            } else {
                // don't charge VAT (we'll add the VAT to the invoice)
            }
            serviceFee = serviceFee * (100 + vat) / 100;
        }

        // Round service fee to 2 decimal places
        serviceFee = Math.round(serviceFee / 100) * 100;

        console.log('Service fee for payment', payment.id, type, 'is', serviceFee);
        if (payment.provider === PaymentProvider.Stripe && payment.stripeAccountId) {
            payment.serviceFeePayout = serviceFee;
        } else {
            payment.serviceFeeManual = serviceFee;
        }
    }

    /**
     * Depends on the situation.
     */
    static async setTransferFee({
        payment,
        organization,
        stripeAccount,
    }: {
        payment: Payment;
        organization: Organization;
        stripeAccount?: StripeAccount | null | undefined;
    }) {
        if (payment.provider !== PaymentProvider.Stripe && payment.provider !== PaymentProvider.Buckaroo) {
            return;
        }

        if (payment.provider === PaymentProvider.Stripe && !stripeAccount) {
            throw new Error('Missing StripeAccount');
        }

        const totalPrice = STMath.round(payment.price / 100); // Convert from 4 decimal places to 2 decimal places for this calculation

        if (totalPrice <= 0) {
            return;
        }

        if (stripeAccount && stripeAccount.meta.type === 'standard') {
            // Submerchant is charged by Stripe for the fees directly
            return;
        }

        let fee = 0;
        const vat = await this.getVATPercentage(organization);

        function calculateFee(fixed: number, percentageTimes100: number) {
            return STMath.round(STMath.round(fixed + Math.max(1, totalPrice * percentageTimes100 / 100 / 100)) * (100 + vat) / 100); // € 0,21 + 0,2%
        }

        if (payment.method === PaymentMethod.iDEAL) {
            fee = calculateFee(21, 20); // € 0,21 + 0,2%
        } else if (payment.method === PaymentMethod.Bancontact) {
            fee = calculateFee(24, 20); // € 0,24 + 0,2%
        } else {
            fee = calculateFee(25, 150); // € 0,25 + 1,5%
        }

        payment.transferFee = fee * 100; // Convert back to 4 decimal places for storage

        if (payment.provider === PaymentProvider.Buckaroo) {
            // We'll need to charge
            payment.transferFeeManual = payment.transferFee;
            console.log('Transfer fee for payment', payment.id, 'is', payment.transferFee, '(manually charged)');
        } else {
            console.log('Transfer fee for payment', payment.id, 'is', payment.transferFee);
        }
    }
}
