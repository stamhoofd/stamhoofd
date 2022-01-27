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
            case PaymentMethod.Payconiq: return "Payconiq";
        }
    }

    static getNameCapitalized(method: PaymentMethod, context: null | "takeout" | "delivery" = null): string {
        switch(method) {
            case PaymentMethod.Unknown: return "Onbekende betaalmethode";
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case "takeout": return "Bij afhalen";
                    case "delivery": return "Bij levering";
                    default: return "Ter plaatse";
                }
            }
            case PaymentMethod.Transfer: return "Overschrijving";
            case PaymentMethod.DirectDebit: return "Domiciliëring";
            case PaymentMethod.Bancontact: return "Bancontact";
            case PaymentMethod.iDEAL: return "iDEAL";
            case PaymentMethod.CreditCard: return "Kredietkaart";
            case PaymentMethod.Payconiq: return "Payconiq";
        }
    }
}