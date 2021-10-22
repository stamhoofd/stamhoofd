export enum PaymentMethod {
    Unknown = "Unknown",
    Transfer = "Transfer",
    DirectDebit = "DirectDebit",
    Bancontact = "Bancontact",
    iDEAL = "iDEAL",
    Payconiq = "Payconiq",
    CreditCard = "CreditCard"
}
export class PaymentMethodHelper {
    static getName(method: PaymentMethod): string {
        switch(method) {
            case PaymentMethod.Unknown: return "onbekende betaalmethode";
            case PaymentMethod.Transfer: return "overschrijving";
            case PaymentMethod.DirectDebit: return "domiciliëring";
            case PaymentMethod.Bancontact: return "Bancontact";
            case PaymentMethod.iDEAL: return "iDEAL";
            case PaymentMethod.CreditCard: return "kredietkaart";
            case PaymentMethod.Payconiq: return "Payconiq";
        }
    }

    static getNameCapitalized(method: PaymentMethod): string {
        switch(method) {
            case PaymentMethod.Unknown: return "Onbekende betaalmethode";
            case PaymentMethod.Transfer: return "Overschrijving";
            case PaymentMethod.DirectDebit: return "Domiciliëring";
            case PaymentMethod.Bancontact: return "Bancontact";
            case PaymentMethod.iDEAL: return "iDEAL";
            case PaymentMethod.CreditCard: return "Kredietkaart";
            case PaymentMethod.Payconiq: return "Payconiq";
        }
    }
}