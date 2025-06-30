import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { Group, MemberDetails, Organization, PaymentMethod } from '@stamhoofd/structures';

// todo: rename?
export class ImportMemberAccumulatedResult {
    readonly data: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>> = {};
    readonly registration = new ImportingRegistration();
    readonly organization: Organization;

    constructor(organization: Organization) {
        this.organization = organization;
    }
}

export class ImportingRegistration {
    group: Group | null = null;
    autoAssignedGroup: Group | null = null;
    paid: boolean | null = null;
    paidPrice: number | null = null;
    price: number | null = null;
    paymentMethod: PaymentMethod | null = null;
    date: Date | null = null;
}
