import { Organization, Payment } from "@stamhoofd/models";
import { calculateVATPercentage, PaymentProvider, STPackageType } from "@stamhoofd/structures";

export class ServiceFeeHelper {
    static setServiceFee(payment: Payment, organization: Organization, type: 'webshop' | 'members') {
        const totalPrice = payment.price;
        let vat = 0;

        if (payment.provider === PaymentProvider.Stripe && payment.stripeAccountId) {
            // Don't chagne 
            vat = calculateVATPercentage(organization.address, organization.meta.VATNumber)
        } else {
            // don't charge VAT (we'll add the VAT to the invoice)
        }

        function calculateFee(fixed: number, percentageTimes100: number) {
            return Math.round(Math.round(fixed + Math.max(1, totalPrice * percentageTimes100 / 100 / 100)) * (100 + vat) / 100); // € 0,21 + 0,2%
        }

        let serviceFee = 0;

        // Calculate service fee if organization has a package with service fees
        if (organization) {
            const packageStatus = type === 'webshop' ? organization.meta.packages.packages.get(STPackageType.Webshops) : organization.meta.packages.packages.get(STPackageType.Members);
            const fees = packageStatus?.activeServiceFees;
            
            console.log("Service fee settings for payment", payment.id, type, "are", fees);

            if (fees && (fees.fixed > 0 || fees.percentage > 0)) {
                serviceFee = calculateFee(fees.fixed, fees.percentage);
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