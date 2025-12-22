import { Group, PaymentMethod, RecordAnswer } from '@stamhoofd/structures';

/**
* Class with data concerning the registration of a member that is being imported (from a spreadsheet).
*/
export class ImportRegistrationResult {
    group: Group | null = null;
    autoAssignedGroup: Group | null = null;
    paid: boolean | null = null;
    paidPrice: number | null = null;
    price: number | null = null;
    priceName: string | null = null;
    paymentMethod: PaymentMethod | null = null;
    startDate: Date | null = null;
    endDate: Date | null = null;
    recordAnswers = new Map<string, RecordAnswer>();
}
