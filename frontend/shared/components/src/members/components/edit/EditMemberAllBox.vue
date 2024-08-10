<template>
    <div class="container">
        <Title :title="member.patchedMember.firstName + ' bewerken'" :level="level" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <EditMemberGeneralBox v-bind="$attrs" :member="member" :validator="validator" />

        <div v-if="isPropertyEnabled('dataPermission')" class="container">
            <hr>
            <EditMemberDataPermissionsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="isPropertyEnabled('parents') || member.patchedMember.details.parents.length" class="container">
            <hr>
            <EditMemberParentsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="isPropertyEnabled('emergencyContacts')" class="container">
            <hr>
            <EditEmergencyContactsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="isPropertyEnabled('uitpasNumber') || member.patchedMember.details.uitpasNumber" class="container">
            <hr>
            <EditMemberUitpasBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="isPropertyEnabled('financialSupport')" class="container">
            <hr>
            <EditMemberFinancialSupportBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-for="category of recordCategories" :key="category.id" class="container">
            <hr>
            <EditMemberRecordCategoryBox v-bind="$attrs" :member="member" :category="category" :mark-reviewed="true" :level="level + 1" :validator="validator" />
        </div>

        <div class="container" v-if="app !== 'registration'">
            <hr>
            <EditMemberNotesBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator"/>
        </div>
    </div>
</template>

<script setup lang="ts">
import { PermissionLevel, PlatformMember } from '@stamhoofd/structures';

import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import { ErrorBox } from '../../../errors/ErrorBox';
import { Validator } from '../../../errors/Validator';
import { useAuth, useOrganization } from '../../../hooks';
import { useIsPropertyEnabled } from '../../hooks/useIsPropertyRequired';
import EditEmergencyContactsBox from './EditEmergencyContactsBox.vue';
import EditMemberDataPermissionsBox from './EditMemberDataPermissionsBox.vue';
import EditMemberFinancialSupportBox from './EditMemberFinancialSupportBox.vue';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';
import EditMemberNotesBox from './EditMemberNotesBox.vue';
import EditMemberParentsBox from './EditMemberParentsBox.vue';
import EditMemberRecordCategoryBox from './EditMemberRecordCategoryBox.vue';
import EditMemberUitpasBox from './EditMemberUitpasBox.vue';
import Title from './Title.vue';

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
const organization = useOrganization()
const app = useAppContext();
const isAdmin = app === 'dashboard' || app === 'admin';
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true)

const recordCategories = computed(() => 
    props.member.getEnabledRecordCategories({
        checkPermissions: isAdmin ? {
            permissions: auth.userPermissions, 
            level: PermissionLevel.Write
        } : null,
        scopeOrganization: organization.value
    })
)

</script>
