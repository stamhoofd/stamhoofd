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
            case PaymentMethod.Unknown: return $t(`%mc`);
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case 'takeout': return $t(`%md`);
                    case 'delivery': return $t(`%me`);
                    case 'Takeout': return $t(`%md`);
                    case 'Delivery': return $t(`%me`);
                    case 'OnSite': return $t(`%mf`);
                    default: return $t(`%mf`);
                }
            }
            case PaymentMethod.Transfer: return $t(`%mg`);
            case PaymentMethod.DirectDebit: return $t(`%mh`);
            case PaymentMethod.Bancontact: return $t(`%1S`);
            case PaymentMethod.iDEAL: return $t(`%1n`);
            case PaymentMethod.CreditCard: return $t(`%mi`);
            case PaymentMethod.Payconiq: return $t(`%1k`);
        }
    }

    static getPaymentName(method: PaymentMethod, type: PaymentType): string {
        if (type === PaymentType.Payment) {
            switch (method) {
                case PaymentMethod.Unknown: return $t(`%mj`);
                case PaymentMethod.PointOfSale: {
                    return $t(`%mk`);
                }
                case PaymentMethod.Transfer: return $t(`%mg`);
                case PaymentMethod.DirectDebit: return $t(`%mh`);
                case PaymentMethod.Bancontact: return $t(`%ml`);
                case PaymentMethod.iDEAL: return $t(`%mm`);
                case PaymentMethod.CreditCard: return $t(`%mn`);
                case PaymentMethod.Payconiq: return $t(`%mo`);
            }
        }

        if (type === PaymentType.Refund) {
            return $t(`%mp`) + ' ' + PaymentMethodHelper.getName(method);
        }

        if (type === PaymentType.Chargeback) {
            return $t(`%mq`) + ' ' + PaymentMethodHelper.getName(method);
        }

        return PaymentTypeHelper.getName(type);
    }

    static getPluralName(method: PaymentMethod): string {
        switch (method) {
            case PaymentMethod.Unknown: return $t(`%mr`);
            case PaymentMethod.PointOfSale: {
                return $t(`%ms`);
            }
            case PaymentMethod.Transfer: return $t(`%lK`);
            case PaymentMethod.DirectDebit: return $t(`%mt`);
            case PaymentMethod.Bancontact: return $t(`%1S`);
            case PaymentMethod.iDEAL: return $t(`%1n`);
            case PaymentMethod.CreditCard: return $t(`%mi`);
            case PaymentMethod.Payconiq: return $t(`%1Q`);
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
