import { Formatter } from '@stamhoofd/utility';

export enum PaymentMethod {
    Unknown = 'Unknown',
    PointOfSale = 'PointOfSale',
    Transfer = 'Transfer',
    DirectDebit = 'DirectDebit',
    Bancontact = 'Bancontact',
    iDEAL = 'iDEAL',
    Payconiq = 'Payconiq',
    CreditCard = 'CreditCard',
}
export enum PaymentMethodV150 {
    Unknown = 'Unknown',
    Transfer = 'Transfer',
    DirectDebit = 'DirectDebit',
    Bancontact = 'Bancontact',
    iDEAL = 'iDEAL',
    Payconiq = 'Payconiq',
    CreditCard = 'CreditCard',
}

export function downgradePaymentMethodV150(newerValue: PaymentMethod): PaymentMethodV150 {
    if (newerValue === PaymentMethod.PointOfSale) {
        return PaymentMethodV150.Transfer;
    }
    return newerValue as unknown as PaymentMethodV150;
}

export function downgradePaymentMethodArrayV150(newerValue: PaymentMethod[]): PaymentMethodV150[] {
    return newerValue.map(v => downgradePaymentMethodV150(v));
}

export class PaymentMethodHelper {
    static getName(method: PaymentMethod, context: null | 'takeout' | 'delivery' | 'Takeout' | 'Delivery' | 'OnSite' = null): string {
        switch (method) {
            case PaymentMethod.Unknown: return 'onbekende betaalmethode';
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case 'takeout': return 'bij afhalen';
                    case 'delivery': return 'bij levering';
                    case 'Takeout': return 'bij afhalen';
                    case 'Delivery': return 'bij levering';
                    case 'OnSite': return 'ter plaatse';
                    default: return 'ter plaatse';
                }
            }
            case PaymentMethod.Transfer: return 'overschrijving';
            case PaymentMethod.DirectDebit: return 'domiciliëring';
            case PaymentMethod.Bancontact: return 'Bancontact';
            case PaymentMethod.iDEAL: return 'iDEAL';
            case PaymentMethod.CreditCard: return 'kredietkaart';
            case PaymentMethod.Payconiq: return 'Payconiq by Bancontact';
        }
    }

    static getPluralName(method: PaymentMethod): string {
        switch (method) {
            case PaymentMethod.Unknown: return 'onbekende betaalmethodes';
            case PaymentMethod.PointOfSale: {
                return 'betalingen ter plaatse';
            }
            case PaymentMethod.Transfer: return 'overschrijvingen';
            case PaymentMethod.DirectDebit: return 'domiciliëringen';
            case PaymentMethod.Bancontact: return 'Bancontact';
            case PaymentMethod.iDEAL: return 'iDEAL';
            case PaymentMethod.CreditCard: return 'kredietkaart';
            case PaymentMethod.Payconiq: return 'Payconiq';
        }
    }

    static getNameCapitalized(method: PaymentMethod, context: null | 'takeout' | 'delivery' | 'Takeout' | 'Delivery' | 'OnSite' = null): string {
        if (method === PaymentMethod.iDEAL) {
            return PaymentMethodHelper.getName(method, context);
        }
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getName(method, context));
    }

    static getPluralNameCapitalized(method: PaymentMethod): string {
        if (method === PaymentMethod.iDEAL) {
            return PaymentMethodHelper.getPluralName(method);
        }
        return Formatter.capitalizeFirstLetter(PaymentMethodHelper.getPluralName(method));
    }
}
