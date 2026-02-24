import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { LimitedFilteredRequest } from '@stamhoofd/structures';
import { PromiseView } from '../../containers';
import { useMembersObjectFetcher } from '../../fetchers';
import { Toast } from '../../overlays/Toast';
import MemberSegmentedView from '../MemberSegmentedView.vue';

export function useShowMember() {
    const memberFetcher = useMembersObjectFetcher();
    const present = usePresent();

    return async (memberId: string) => {
        const component = new ComponentWithProperties(NavigationController, {
            root: new ComponentWithProperties(PromiseView, {
                promise: async () => {
                    const members = await memberFetcher.fetch(new LimitedFilteredRequest({
                        filter: {
                            id: memberId,
                        },
                        limit: 1,
                    }));
                    if (members.results.length === 0) {
                        Toast.error($t(`22541ecc-ba4f-4a91-b8d3-8213bfaaea0b`)).show();
                        throw new Error('Member not found');
                    }
                    return new ComponentWithProperties(MemberSegmentedView, {
                        member: members.results[0],
                    });
                },
            }),
        });

        await present({
            components: [component],
            modalDisplayStyle: 'popup',
        });
    };
}
