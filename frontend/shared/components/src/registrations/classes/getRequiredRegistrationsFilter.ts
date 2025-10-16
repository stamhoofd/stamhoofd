import { Group, GroupType, StamhoofdFilter } from '@stamhoofd/structures';
import { useOrganization, usePlatform } from '../../hooks';
import { Formatter } from '@stamhoofd/utility';

export function useRequiredRegistrationsFilter() {
    const organization = useOrganization();
    const platform = usePlatform();

    function getRequiredRegistrationsFilter(props: { group?: Group; periodId?: string }, onRegistrations = false) {
        const extra: StamhoofdFilter[] = [];

        if (organization.value && props.group && props.group.organizationId !== organization.value?.id) {
            // Only show members that are registered in the current period AND in this group
            // (avoid showing old members that moved to other groups)
            const periodIds = [props.group.periodId];
            if (props.periodId) {
                periodIds.push(props.periodId);
            }
            if (organization?.value?.period?.period?.id) {
                periodIds.push(organization.value.period.period.id);
            }
            if (platform.value.period.id) {
                periodIds.push(platform.value.period.id);
            }
            const b = {
                registrations: {
                    $elemMatch: {
                        organizationId: organization.value.id,
                        periodId: {
                            $in: Formatter.uniqueArray(periodIds),
                        },
                        group: {
                            // Do not show members that are only registered for a waiting list or event
                            type: GroupType.Membership,
                        },
                    },
                },
            };

            if (onRegistrations) {
                extra.push({
                    member: b,
                });
            }
            else {
                extra.push(b);
            }
        }
        return extra;
    }

    return {
        getRequiredRegistrationsFilter,
    };
}
