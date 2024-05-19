<template>
    <div>
        <EditMemberGeneralBox v-bind="$attrs" :member="member" />

        <div v-if="member.isPropertyEnabled('dataPermission')" class="container">
            <hr>
            <EditMemberDataPermissionsBox v-bind="$attrs" :member="member" :level="2" />
        </div>

        <div v-if="member.isPropertyEnabled('parents')" class="container">
            <hr>
            <h2>Ouders</h2>
            <EditMemberParentsBox v-bind="$attrs" :member="member" />
        </div>

        <div v-if="member.isPropertyEnabled('emergencyContacts')" class="container">
            <hr>
            <h2>Noodcontactpersonen</h2>
            <EditEmergencyContactsBox v-bind="$attrs" :member="member" />
        </div>

        <div v-for="category of recordCategories" :key="category.id" class="container">
            <hr>
            <EditMemberRecordCategoryBox v-bind="$attrs" :member="member" :category="category" :mark-reviewed="true" :level="2" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { PlatformMember } from '@stamhoofd/structures';

import EditEmergencyContactsBox from './EditEmergencyContactsBox.vue';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';
import EditMemberParentsBox from './EditMemberParentsBox.vue';
import { computed } from 'vue';
import EditMemberRecordCategoryBox from './EditMemberRecordCategoryBox.vue';
import EditMemberDataPermissionsBox from './EditMemberDataPermissionsBox.vue';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember,
}>();

const recordCategories = computed(() => props.member.getEnabledRecordCategories())

</script>
