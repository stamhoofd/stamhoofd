<template>
    <div class="container">
        <Title :title="title ?? (member.patchedMember.firstName + ' ' + $t(`ee3bc635-c294-4134-9155-7a74f47dec4f`))" :level="level" />

        <STErrorsDefault :error-box="parentErrorBox" />
        <EditMemberGeneralBox v-bind="$attrs" :member="member" :validator="validator" />

        <div v-if="isPropertyEnabled('dataPermission')" class="container">
            <hr><EditMemberDataPermissionsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="member.patchedMember.details.parents.length || isPropertyEnabled('parents')" class="container">
            <hr><EditMemberParentsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="member.patchedMember.details.emergencyContacts.length || isPropertyEnabled('emergencyContacts')" class="container">
            <hr><EditEmergencyContactsBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="member.patchedMember.details.uitpasNumberDetails || isPropertyEnabled('uitpasNumber')" class="container">
            <hr><EditMemberUitpasBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="isPropertyEnabled('financialSupport') || member.patchedMember.details.requiresFinancialSupport !== null || member.patchedMember.details.uitpasNumberDetails?.isActive" class="container">
            <hr><EditMemberFinancialSupportBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
        </div>

        <div v-for="category of recordCategories.categories" :key="category.id" class="container">
            <hr><EditMemberRecordCategoryBox v-bind="$attrs" :member="member" :is-admin="recordCategories.adminPermissionsMap.get(category.id) ?? false" :category="category" :level="level + 1" :validator="validator" />
        </div>

        <div v-if="app !== 'registration'" class="container">
            <hr><EditMemberNotesBox v-bind="$attrs" :member="member" :level="level + 1" :validator="validator" />
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
    inheritAttrs: false,
});

const props = withDefaults(
    defineProps<{
        member: PlatformMember;
        validator: Validator;
        level?: number;
        parentErrorBox?: ErrorBox | null;
        title?: string | null;
    }>(), {
        level: 0,
        parentErrorBox: null,
        title: null,
    },
);
const auth = useAuth();
const app = useAppContext();
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);
const organization = useOrganization();

const recordCategories = computed(() =>
    props.member.getEnabledRecordCategories({
        checkPermissions: {
            user: auth.user!,
            level: PermissionLevel.Write,
        },
        scopeOrganization: organization.value,
    }),
);
</script>
