<template>
    <div v-if="notes">
        <div class="hover-box container">
            <hr>
            <h2 class="style-with-button"><div>Notities</div></h2>
            <dl class="details-grid hover">
                <MemberDetailWithButton
                        :value="notes" icon="edit" color="gray" @click-button="editThisMember"/>
            </dl>
        </div>  
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useEditMember } from '../../composables/useEditMember';
import MemberDetailWithButton from '../detail/MemberDetailWithButton.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>();

const editMember = useEditMember();
const memberDetails = computed(() => props.member.patchedMember.details);
const notes = computed(() => memberDetails.value.notes);

async function editThisMember() {
    await editMember(props.member);
}
</script>
