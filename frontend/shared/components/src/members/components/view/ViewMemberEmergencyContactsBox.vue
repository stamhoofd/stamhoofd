<template>
    <div>
        <ViewMemberEmergencyContactBox v-for="emergencyContact of member.patchedMember.details.emergencyContacts" :key="emergencyContact.id" :member="member" :emergency-contact="emergencyContact" />
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';
import ViewMemberEmergencyContactBox from './ViewMemberEmergencyContactBox.vue';

defineOptions({
    inheritAttrs: false
})

defineProps<{
    member: PlatformMember
}>()

</script>
