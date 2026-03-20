<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <span class="icon-spacer">{{ $t('%16X') }}</span>
        </h2>

        <STList>
            <STListItem :selectable="true" @click="editMember">
                <template #left>
                    <span class="icon edit" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%fj') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" @click="addRegistration">
                <template #left>
                    <span class="icon add" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('%fk', {member: props.member.patchedMember.firstName}) }}
                </h3>
            </STListItem>

            <STListItem v-if="member.patchedMember.registrations.length === 0" :selectable="true" @click="deleteMember">
                <template #left>
                    <span class="icon trash red" />
                </template>

                <h3 class="style-title-list red">
                    {{ $t('%ek') }}
                </h3>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import type { PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import type { MemberWithRegistrationsBlob, PlatformMember } from '@stamhoofd/structures';
import { DeleteView } from '../../../..';
import { GlobalEventBus } from '../../../EventBus';
import { Toast } from '../../../overlays/Toast';
import { useChooseGroupForMember } from '../../checkout';
import { useEditMember } from '../../hooks';
import { usePlatformFamilyManager } from '../../PlatformFamilyManager';

defineOptions({
    inheritAttrs: false,
});
const props = defineProps<{
    member: PlatformMember;
}>();
const $editMember = useEditMember();
const present = usePresent();
const dismiss = useDismiss();
const platformFamilyManager = usePlatformFamilyManager();
const chooseGroupForMember = useChooseGroupForMember();

async function editMember() {
    await $editMember(props.member, { title: $t(`%XO`) });
}
async function addRegistration() {
    await chooseGroupForMember({ member: props.member, displayOptions: { action: 'show' } });
}

async function deleteMember() {
    const member = props.member;
    const name = member.patchedMember.name;

    await present({
        components: [
            new ComponentWithProperties(DeleteView, {
                title: $t(`%15Y`, { name }),
                description: $t(`%15Z`, { name }),
                confirmationTitle: $t(`%eu`),
                confirmationPlaceholder: $t(`%10H`),
                confirmationCode: name,
                checkboxText: $t(`%6P`),
                onDelete: async () => {
                    const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    patch.addDelete(member.id);

                    await platformFamilyManager.isolatedPatch([member], patch);
                    GlobalEventBus.sendEvent('members-deleted', [member]).catch(console.error);

                    Toast.success(
                        $t('%15D', {
                            name,
                        }),
                    ).show();

                    await dismiss({ force: true });
                    return true;
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

</script>
