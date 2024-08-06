<template>
    <div v-if="notes">
        <div class="hover-box container">
            <hr>
            <h2 class="style-with-button">
                <div>Notities</div>
                <div class="hover-show">
                <button v-if="hasWrite" type="button" class="button icon edit gray" @click.prevent="editThisMember" />
            </div>
            </h2>
            <p class="style-description-small">{{ notes }}</p>
        </div>  
    </div>
</template>

<script setup lang="ts">
import { PermissionLevel, PlatformMember } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAuth } from '../../../hooks';
import { useEditMember } from '../../composables/useEditMember';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>();

const editMember = useEditMember();
const auth = useAuth();

const memberDetails = computed(() => props.member.patchedMember.details);
const notes = computed(() => memberDetails.value.notes);
const hasWrite = auth.canAccessPlatformMember(props.member, PermissionLevel.Write);

async function editThisMember() {
    await editMember(props.member);
}
</script>


<style lang="scss" scoped>
.notes {
    grid-column: span 2;
    white-space: pre-line;
}
</style>
