import { Formatter } from '@stamhoofd/utility';
import { PaymentType, PaymentTypeHelper } from './PaymentType.js';

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
            case PaymentMethod.Unknown: return $t(`onbekende betaalmethode`);
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case 'takeout': return $t(`bij afhalen`);
                    case 'delivery': return $t(`bij levering`);
                    case 'Takeout': return $t(`bij afhalen`);
                    case 'Delivery': return $t(`bij levering`);
                    case 'OnSite': return $t(`ter plaatse`);
                    default: return $t(`ter plaatse`);
                }
            }
            case PaymentMethod.Transfer: return $t(`overschrijving`);
            case PaymentMethod.DirectDebit: return $t(`domiciliëring`);
            case PaymentMethod.Bancontact: return $t(`Bancontact`);
            case PaymentMethod.iDEAL: return $t(`iDEAL`);
            case PaymentMethod.CreditCard: return $t(`kredietkaart`);
            case PaymentMethod.Payconiq: return $t(`Payconiq by Bancontact`);
        }
    }

    static getPaymentName(method: PaymentMethod, type: PaymentType): string {
        if (type === PaymentType.Payment) {
            switch (method) {
                case PaymentMethod.Unknown: return $t(`onbekende betaling`);
                case PaymentMethod.PointOfSale: {
                    return $t(`betaling ter plaatse`);
                }
                case PaymentMethod.Transfer: return $t(`overschrijving`);
                case PaymentMethod.DirectDebit: return $t(`domiciliëring`);
                case PaymentMethod.Bancontact: return $t(`Bancontact betaling`);
                case PaymentMethod.iDEAL: return $t(`iDEAL betaling`);
                case PaymentMethod.CreditCard: return $t(`kredietkaart betaling`);
                case PaymentMethod.Payconiq: return $t(`Payconiq betaling`);
            }
        }

        if (type === PaymentType.Refund) {
            return $t(`terugbetaling via`) + ' ' + PaymentMethodHelper.getName(method);
        }

        if (type === PaymentType.Chargeback) {
            return $t(`terugvordering van`) + ' ' + PaymentMethodHelper.getName(method);
        }

        return PaymentTypeHelper.getName(type);
    }

    static getPluralName(method: PaymentMethod): string {
        switch (method) {
            case PaymentMethod.Unknown: return $t(`onbekende betaalmethodes`);
            case PaymentMethod.PointOfSale: {
                return $t(`betalingen ter plaatse`);
            }
            case PaymentMethod.Transfer: return $t(`overschrijvingen`);
            case PaymentMethod.DirectDebit: return $t(`domiciliëringen`);
            case PaymentMethod.Bancontact: return $t(`Bancontact`);
            case PaymentMethod.iDEAL: return $t(`iDEAL`);
            case PaymentMethod.CreditCard: return $t(`kredietkaart`);
            case PaymentMethod.Payconiq: return $t(`Payconiq`);
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
