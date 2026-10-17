export type RegistrationGroup = {
    id: string;
    organizationId: string;
    periodId: string | null;
    settings: {
        period: { id: string; locked: boolean; nameShort: string } | null;
        name: { toString(): string };
    };
};

export interface RegistrationReference {
    id: string;
    groupId: string;
    organizationId: string;
    calculatedPrice: number;
    trialUntil: Date | null;
    stockReservations: unknown[];
    balances: { amountPaid: number; amountPending: number }[];
    group: RegistrationGroup;
    clone(): this;
}

export type PlatformMemberReference = {
    platform: {
        period: { id: string; locked: boolean; nameShort: string };
    };
};
