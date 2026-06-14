import type { AutoEncoderPatchType, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, usePresent } from '@simonbackx/vue-app-navigation';
import { AsyncComponent } from '@stamhoofd/components/containers/AsyncComponent.ts';

import { useRequiredOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { usePatchOrganizationPeriod } from '@stamhoofd/networking/hooks/usePatchOrganizationPeriod';
import { Group, GroupCategory, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, OrganizationGenderType, OrganizationRegistrationPeriod, OrganizationRegistrationPeriodSettings } from '@stamhoofd/structures';

export function useCreateGroupView(saveHandler?: (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => Promise<void> | void) {
    const present = usePresent();
    const organization = useRequiredOrganization();
    const patchOrganizationPeriod = usePatchOrganizationPeriod();

    return async function createGroup(period: OrganizationRegistrationPeriod, parentCategory: GroupCategory) {
        const groups: PatchableArrayAutoEncoder<Group> = new PatchableArray();

        const group = Group.create({
            organizationId: organization.value.id,
            periodId: period.period.id,
            settings: GroupSettings.create({
                genderType: organization.value.meta.genderType === OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale,
            }),
            privateSettings: GroupPrivateSettings.create({}),
            status: GroupStatus.Closed,
        });
        const settings = OrganizationRegistrationPeriodSettings.patch({});

        const me = GroupCategory.patch({ id: parentCategory.id });
        me.groupIds.addPut(group.id);
        settings.categories.addPatch(me);

        groups.addPut(group);

        const basePatch = OrganizationRegistrationPeriod.patch({ groups, settings, id: period.id });

        const displayedComponent = AsyncComponent(() => import('@stamhoofd/components/groups/EditGroupView.vue'), {
            period: period.patch(basePatch),
            groupId: group.id,
            isNew: true,
            saveHandler: (saveHandler
                ? async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                    await saveHandler(basePatch.patch(patch));
                }
                : null)
            ?? (async (patch: AutoEncoderPatchType<OrganizationRegistrationPeriod>) => {
                await patchOrganizationPeriod(period, basePatch.patch(patch));
            }),
        });

        await present({
            components: [displayedComponent],
            modalDisplayStyle: 'popup',
        });
    };
}
