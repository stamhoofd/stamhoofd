<template>
    <div class="hover-box container">
        <hr><h2 class="style-with-button">
            <span class="icon-spacer">{{ $t('Acties') }}</span>
        </h2>

        <STList>
            <STListItem :selectable="true" @click="editMember">
                <template #left>
                    <span class="icon edit" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('Gegevens wijzigen') }}
                </h3>
            </STListItem>

            <STListItem :selectable="true" @click="addRegistration">
                <template #left>
                    <span class="icon add" />
                </template>

                <h3 class="style-title-list">
                    {{ $t('{member} inschrijven', {member: props.member.patchedMember.firstName}) }}
                </h3>
            </STListItem>

            <STListItem v-if="member.patchedMember.registrations.length === 0" :selectable="true" @click="deleteMember">
                <template #left>
                    <span class="icon trash red" />
                </template>

                <h3 class="style-title-list red">
                    {{ $t('Definitief verwijderen') }}
                </h3>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { PatchableArray, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { ComponentWithProperties, useDismiss, usePresent } from '@simonbackx/vue-app-navigation';
import { MemberWithRegistrationsBlob, PlatformMember } from '@stamhoofd/structures';
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
    await $editMember(props.member, { title: 'Gegevens bewerken' });
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
                title: `${name} definitief verwijderen?`,
                description: `Ben je 100% zeker dat je ${name} wilt verwijderen? Vul dan de volledige naam van het lid in ter bevestiging. Je kan dit niet ongedaan maken.`,
                confirmationTitle: 'Bevestig de naam van het lid',
                confirmationPlaceholder: 'Volledige naam',
                confirmationCode: name,
                checkboxText: 'Ja, ik ben 100% zeker',
                onDelete: async () => {
                    const patch = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;
                    patch.addDelete(member.id);

                    await platformFamilyManager.isolatedPatch([member], patch);
                    GlobalEventBus.sendEvent('members-deleted', [member]).catch(console.error);

                    Toast.success(name + ' is verwijderd').show();

                    await dismiss({ force: true });
                    return true;
                },
            }),
        ],
        modalDisplayStyle: 'sheet',
    });
}

</script>
