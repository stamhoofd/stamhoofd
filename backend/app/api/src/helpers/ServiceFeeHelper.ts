import { Organization, Payment } from "@stamhoofd/models";
import { calculateVATPercentage, PaymentProvider, STPackageType } from "@stamhoofd/structures";

export class ServiceFeeHelper {
    static setServiceFee(payment: Payment, organization: Organization, type: 'webshop' | 'members' | 'tickets', itemPrices: number[]): void {
        let vat = 0;

        // Calculate item count
        if (payment.provider === PaymentProvider.Stripe && payment.stripeAccountId) {
            // Don't chagne 
            vat = calculateVATPercentage(organization.address, organization.meta.VATNumber)
        } else {
            // don't charge VAT (we'll add the VAT to the invoice)
        }

        function calculateFee(price: number, minimumFee: number | null, maximumFee: number | null, fixed: number, percentageTimes100: number) {
            if (price === 0 && !minimumFee) {
                return 0;
            }
            let fee = Math.round(fixed + Math.max(1, price * percentageTimes100 / 100 / 100));
            if (minimumFee !== null && fee < minimumFee) {
                fee = minimumFee;
            }
            if (maximumFee !== null && fee > maximumFee) {
                fee = maximumFee;
            }
            return Math.round(
                fee * (100 + vat) / 100
            ); // € 0,21 + 0,2%
        }

        let serviceFee = 0;

        // Calculate service fee if organization has a package with service fees
        if (organization) {
            const packageStatus = type === 'webshop' || type === 'tickets' ? organization.meta.packages.packages.get(STPackageType.Webshops) : organization.meta.packages.packages.get(STPackageType.Members);
            const fees = packageStatus?.activeServiceFees;
            
            console.log("Service fee settings for payment", payment.id, type, "are", fees);

            if (fees && (fees.fixed > 0 || fees.percentage > 0)) {
                serviceFee = itemPrices.reduce((total, price) => {
                    return total + calculateFee(
                        price, 
                        fees.minimum, 
                        fees.maximum,
                        fees.fixed, 
                        fees.percentage
                    );
                }, 0);
            }
        }

        console.log("Service fee for payment", payment.id, type, "is", serviceFee);
        if (payment.provider === PaymentProvider.Stripe && payment.stripeAccountId) {
            payment.serviceFeePayout = serviceFee
        } else {
            payment.serviceFeeManual = serviceFee;
        }
    }
}