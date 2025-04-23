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
            case PaymentMethod.Unknown: return $t(`25826958-2433-46d3-8173-b8fc965afa5c`);
            case PaymentMethod.PointOfSale: {
                switch (context) {
                    case 'takeout': return $t(`33afe122-83b9-4e99-a6b8-fc5b8cdfe58c`);
                    case 'delivery': return $t(`62c03cb7-9d12-4e11-a5aa-1fb2afa1bbf7`);
                    case 'Takeout': return $t(`33afe122-83b9-4e99-a6b8-fc5b8cdfe58c`);
                    case 'Delivery': return $t(`62c03cb7-9d12-4e11-a5aa-1fb2afa1bbf7`);
                    case 'OnSite': return $t(`4f08cecb-574a-4526-9cd2-660d0fbf6a6c`);
                    default: return $t(`4f08cecb-574a-4526-9cd2-660d0fbf6a6c`);
                }
            }
            case PaymentMethod.Transfer: return $t(`c87a5b7b-f01e-4fe2-91c7-0e9848112562`);
            case PaymentMethod.DirectDebit: return $t(`5e93b172-67cf-4c24-a536-87841f9f691d`);
            case PaymentMethod.Bancontact: return $t(`b96a2898-7229-4397-99f1-2ffd761982f3`);
            case PaymentMethod.iDEAL: return $t(`aa5a52fe-dd8e-4d28-9dcc-a730146e7972`);
            case PaymentMethod.CreditCard: return $t(`8da866ba-9114-4633-874c-99c2ea891bb8`);
            case PaymentMethod.Payconiq: return $t(`a4dde8e6-d0f7-4ad6-b880-cf5467771770`);
        }
    }

    static getPaymentName(method: PaymentMethod, type: PaymentType): string {
        if (type === PaymentType.Payment) {
            switch (method) {
                case PaymentMethod.Unknown: return $t(`f55265bb-9195-41f3-aa1a-2cc3cdede548`);
                case PaymentMethod.PointOfSale: {
                    return $t(`18a3f444-ebbc-4ff5-97a1-d998cd2f492f`);
                }
                case PaymentMethod.Transfer: return $t(`c87a5b7b-f01e-4fe2-91c7-0e9848112562`);
                case PaymentMethod.DirectDebit: return $t(`5e93b172-67cf-4c24-a536-87841f9f691d`);
                case PaymentMethod.Bancontact: return $t(`4598e313-8d8f-4b93-8f74-ebb5181618d1`);
                case PaymentMethod.iDEAL: return $t(`f0b41cb9-069f-4517-8835-32d7cccf1412`);
                case PaymentMethod.CreditCard: return $t(`0e1dc050-b6cf-42a4-9864-4baef47ca493`);
                case PaymentMethod.Payconiq: return $t(`a5d2a9f9-7c74-4f4b-93a9-a502b852cd1f`);
            }
        }

        if (type === PaymentType.Refund) {
            return $t(`cd62f52c-24af-4a99-800c-8b6199e26f35`) + ' ' + PaymentMethodHelper.getName(method);
        }

        if (type === PaymentType.Chargeback) {
            return $t(`fbe9ad23-8ce1-4e78-84ba-f0ee6a841045`) + ' ' + PaymentMethodHelper.getName(method);
        }

        return PaymentTypeHelper.getName(type);
    }

    static getPluralName(method: PaymentMethod): string {
        switch (method) {
            case PaymentMethod.Unknown: return $t(`4a3878c2-ee66-4e0c-9c3f-8221d0944469`);
            case PaymentMethod.PointOfSale: {
                return $t(`a5876255-c41e-42df-8e7a-642492b09fa3`);
            }
            case PaymentMethod.Transfer: return $t(`97f33d05-54af-4568-a932-4dac4530417f`);
            case PaymentMethod.DirectDebit: return $t(`ca7bc184-3548-4198-935f-b0fea69ea2da`);
            case PaymentMethod.Bancontact: return $t(`b96a2898-7229-4397-99f1-2ffd761982f3`);
            case PaymentMethod.iDEAL: return $t(`aa5a52fe-dd8e-4d28-9dcc-a730146e7972`);
            case PaymentMethod.CreditCard: return $t(`8da866ba-9114-4633-874c-99c2ea891bb8`);
            case PaymentMethod.Payconiq: return $t(`8f39177b-f214-4f23-82ab-329c66ae731a`);
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
