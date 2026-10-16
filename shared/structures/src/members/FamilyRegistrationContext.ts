import type { StockReservation } from '../StockReservation.js';

export interface FamilyRegistrationItem<M, G, O> {
    id: string;
    member: M;
    group: G;
    groupId: string;
    organization: O;
    calculatedStartDate: Date;
    getPendingStockReservations(): StockReservation[];
}

export interface FamilyRegistrationContext<M, G, O, R> {
    asOrganizationId: string | null;
    readonly isAdminFromSameOrganization: boolean;
    readonly singleOrganization: O | null;
    cart: {
        items: FamilyRegistrationItem<M, G, O>[];
        deleteRegistrations: { registration: R }[];
        contains(item: { id: string; member: M; groupId: string }): boolean;
    };
}
