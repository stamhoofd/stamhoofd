import { CheckoutMethodType } from "./webshops/WebshopMetaData";

export enum PaymentMethod {
    Unknown = "Unknown",
    PointOfSale = "PointOfSale",
    Transfer = "Transfer",
    DirectDebit = "DirectDebit",
    Bancontact = "Bancontact",
    iDEAL = "iDEAL",
    Payconiq = "Payconiq",
    CreditCard = "CreditCard"
}
export enum PaymentMethodV150 {
    Unknown = "Unknown",
    Transfer = "Transfer",
    DirectDebit = "DirectDebit",
    Bancontact = "Bancontact",
    iDEAL = "iDEAL",
    Payconiq = "Payconiq",
    CreditCard = "CreditCard"
}

export function downgradePaymentMethodV150(newerValue: PaymentMethod): PaymentMethodV150 {
    if (newerValue === PaymentMethod.PointOfSale) {
        return PaymentMethodV150.Transfer
    }
    return newerValue as unknown as PaymentMethodV150
} 

export function downgradePaymentMethodArrayV150(newerValue: PaymentMethod[]): PaymentMethodV150[] {
    return newerValue.map(v => downgradePaymentMethodV150(v))
} 


export class PaymentMethodHelper {
    static getName(method: PaymentMethod, context: null | "takeout" | "delivery" = null): string {
        switch(method) {
            case PaymentMethod.Unknown: return "onbekende betaalmethode";
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case "takeout": return "bij afhalen";
                    case "delivery": return "bij levering";
                    default: return "ter plaatse";
                }
            }
            case PaymentMethod.Transfer: return "overschrijving";
            case PaymentMethod.DirectDebit: return "domiciliëring";
            case PaymentMethod.Bancontact: return "Bancontact";
            case PaymentMethod.iDEAL: return "iDEAL";
            case PaymentMethod.CreditCard: return "kredietkaart";
            case PaymentMethod.Payconiq: return "Payconiq by Bancontact";
        }
    }

    static getNameCapitalized(method: PaymentMethod, context: null | "takeout" | "delivery" | 'Takeout' | 'Delivery' | 'OnSite' = null): string {
        switch(method) {
            case PaymentMethod.Unknown: return "Onbekende betaalmethode";
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case "takeout":
                    case 'Takeout': 
                        return "Bij afhalen";
                    case "delivery": 
                    case 'Delivery':
                        return "Bij levering";
                    default: return "Ter plaatse";
                }
            }
            case PaymentMethod.Transfer: return "Overschrijving";
            case PaymentMethod.DirectDebit: return "Domiciliëring";
            case PaymentMethod.Bancontact: return "Bancontact";
            case PaymentMethod.iDEAL: return "iDEAL";
            case PaymentMethod.CreditCard: return "Kredietkaart";
            case PaymentMethod.Payconiq: return "Payconiq by Bancontact";
        }
    }
}