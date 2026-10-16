export interface ReviewSessionContext {
    organization: {
        meta: {
            packages: {
                useMembers: boolean;
                isMembersTrial: boolean;
                useWebshops: boolean;
                isWebshopsTrial: boolean;
            };
        };
    } | null;
}
