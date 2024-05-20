<template>
    <div class="container">
        <Title :title="member.patchedMember.firstName + ' bewerken'" :level="level" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <EditMemberGeneralBox v-bind="$attrs" :member="member" :validator="validator" />

        <div v-if="member.isPropertyEnabled('dataPermission')" class="container">
            <hr>
            <EditMemberDataPermissionsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="member.isPropertyEnabled('parents')" class="container">
            <hr>
            <EditMemberParentsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="member.isPropertyEnabled('emergencyContacts')" class="container">
            <hr>
            <EditEmergencyContactsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-for="category of recordCategories" :key="category.id" class="container">
            <hr>
            <EditMemberRecordCategoryBox v-bind="$attrs" :member="member" :category="category" :mark-reviewed="true" :level="level + 1" :validator="validator" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { PermissionLevel, PlatformMember } from '@stamhoofd/structures';

import { computed } from 'vue';
import { Validator } from '../../../errors/Validator';
import EditEmergencyContactsBox from './EditEmergencyContactsBox.vue';
import EditMemberDataPermissionsBox from './EditMemberDataPermissionsBox.vue';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';
import EditMemberParentsBox from './EditMemberParentsBox.vue';
import EditMemberRecordCategoryBox from './EditMemberRecordCategoryBox.vue';
import Title from './Title.vue';
import { useAuth } from '../../../hooks';
import { ErrorBox } from '../../../errors/ErrorBox';

defineOptions({
    inheritAttrs: false
})

const props = withDefaults(
    defineProps<{
        member: PlatformMember,
        validator: Validator,
        level?: number,
        parentErrorBox?: ErrorBox | null
    }>(), {
        level: 0,
        parentErrorBox: null
    }
);
const auth = useAuth()

const recordCategories = computed(() => props.member.getEnabledRecordCategories(auth.userPermissions, PermissionLevel.Write))

</script>
