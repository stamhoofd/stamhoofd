export interface EventPermissionData {
    id: string;
    organizationId: string | null;
    meta: {
        defaultAgeGroupIds: string[] | null;
        groups: { id: string }[] | null;
        organizationTagIds: string[] | null;
    };
}

export interface EventPeriodPermissionData extends EventPermissionData {
    startDate: Date;
}
