import { useProvideMemberViewLoaders } from '#members/memberViewLoaders.ts';

export function useProvideMemberViews() {
    useProvideMemberViewLoaders({
        details: () => import('#members/tabs/MemberDetailsTab.vue'),
    });
}
