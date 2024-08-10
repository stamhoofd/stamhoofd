<template>
    <div class="hover-box container">
        <hr>
        <h2 class="style-with-button">
            <span class="icon-spacer">Acties</span>
        </h2>

        <STList>
            <STListItem :selectable="true" @click="editMember">
                <template #left>
                    <span class="icon edit" />
                </template>

                <h3 class="style-title-list">
                    Gegevens wijzigen
                </h3>
            </STListItem>

            <STListItem :selectable="true" @click="addRegistration">
                <template #left>
                    <span class="icon add" />
                </template>

                <h3 class="style-title-list">
                    {{ props.member.patchedMember.firstName }} inschrijven
                </h3>
            </STListItem>
        </STList>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { useChooseGroupForMember } from '../../checkout';
import { useEditMember } from '../../hooks';

defineOptions({
    inheritAttrs: false
})
const props = defineProps<{
    member: PlatformMember
}>()
const $editMember = useEditMember();
const chooseGroupForMember = useChooseGroupForMember()

async function editMember() {
    await $editMember(props.member, {title: 'Gegevens bewerken'});
}
async function addRegistration() {
    await chooseGroupForMember({member: props.member, displayOptions: {action: 'show'}})
}

</script>
