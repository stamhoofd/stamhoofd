import { useProvideGroupViewLoaders } from '#groups/groupViewLoaders.ts';

export function useProvideGroupViews() {
    useProvideGroupViewLoaders({
        editGroup: () => import('#groups/EditGroupView.vue'),
    });
}
