export enum PaymentMethod {
    Unknown = "Unknown",
    Transfer = "Transfer",
    DirectDebit = "DirectDebit",
    Bancontact = "Bancontact",
    iDEAL = "iDEAL",
    Payconiq = "Payconiq"
}
export class PaymentMethodHelper {
    static getName(method: PaymentMethod): string {
        switch(method) {
            case PaymentMethod.Unknown: return "onbekende betaalmethode";
            case PaymentMethod.Transfer: return "overschrijving";
            case PaymentMethod.DirectDebit: return "domiciliëring";
            case PaymentMethod.Bancontact: return "Bancontact";
            case PaymentMethod.iDEAL: return "iDEAL";
            case PaymentMethod.Payconiq: return "Payconiq";
        }
    }
}