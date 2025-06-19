import { Event, Group, GroupSettings, GroupStatus, GroupType, Organization, TranslatedString } from '@stamhoofd/structures';
import { useOrganization } from '../../hooks';
import { ComponentWithProperties, NavigationController, usePresent } from '@simonbackx/vue-app-navigation';
import { SearchOrganizationView } from '../../members';
import { NavigationActions } from '../../types/NavigationActions';

export function useCreateEventGroup() {
    const organization = useOrganization();
    const present = usePresent();

    /**
     * We don't use a promise here because there would be a memory leak if the presented component would be closed without selecting an organization
     */
    return async function (event: Event, setGroup: (group: Group) => void | Promise<void>) {
        const organizationId = event.organizationId ?? organization.value?.id ?? '';

        const group = Group.create({
            organizationId,
            periodId: organization.value?.period.period.id,
            type: GroupType.EventRegistration,
            settings: GroupSettings.create({
                name: TranslatedString.create(event.name),
            }),
            status: GroupStatus.Closed,
        });

        if (!organizationId) {
            // Kies een organisator
            await present({
                components: [
                    new ComponentWithProperties(NavigationController, {
                        root: new ComponentWithProperties(SearchOrganizationView, {
                            title: $t('67967405-d320-4d40-8dc0-889915da1f34'),
                            description: $t('2e5e052c-98b7-4375-b771-05a8913c145b'),
                            selectOrganization: async (organization: Organization, navigationActions: NavigationActions) => {
                                group.organizationId = organization.id;
                                group.periodId = organization.period.period.id;
                                await setGroup(group);
                                await navigationActions.dismiss({ force: true });
                            },
                        }),
                    }),
                ],
                modalDisplayStyle: 'popup',
            });
            return;
        }
        await setGroup(group);
    };
}
