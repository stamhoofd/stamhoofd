<template>
    <STErrorsDefault :error-box="parentErrorBox" />

    <CategorizedBox icon="user" :title="member.isNew ? $t('%103') : $t('%Lb')">
        <EditMemberGeneralBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-if="isPropertyEnabled('dataPermission')" icon="privacy" :title="dataPermissionSettings.title">
        <EditMemberDataPermissionsBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-if="member.patchedMember.details.parents.length || isPropertyEnabled('parents')" icon="group" :title="$t('%XH')">
        <template v-if="member.patchedMember.details.parents.length" #summary>
            <p class="style-description-small">
                {{ member.patchedMember.details.parents.map(p => p.name).join(', ') }}
            </p>
        </template>
        <EditMemberParentsBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-if="isPropertyEnabled('taxCertificates') && member.patchedMember.details.parents.length" icon="file" :title="$t('Fiscale attesten')">
        <EditMemberTaxCertificateBox v-bind="$attrs" :member="member" :validator="validator" :parent-error-box="parentErrorBox" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-if="member.patchedMember.details.emergencyContacts.length || isPropertyEnabled('emergencyContacts')" icon="smartphone" :title="$t('%f1')">
        <template v-if="member.patchedMember.details.emergencyContacts.length" #summary>
            <p class="style-description-small">
                {{ member.patchedMember.details.emergencyContacts.map(c => c.name).join(', ') }}
            </p>
        </template>
        <EditEmergencyContactsBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-if="member.patchedMember.details.uitpasNumberDetails || isPropertyEnabled('uitpasNumber')" icon="card" :title="isAdmin ? $t('%wF') : $t('%14')">
        <template v-if="member.patchedMember.details.uitpasNumberDetails" #summary>
            <p class="style-description-small">
                {{ member.patchedMember.details.uitpasNumberDetails.uitpasNumber }}
            </p>
        </template>
        <EditMemberUitpasBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-if="isPropertyEnabled('financialSupport') || member.patchedMember.details.requiresFinancialSupport !== null || member.patchedMember.details.uitpasNumberDetails?.isActive" icon="receive" :title="financialSupportSettings.title">
        <template #summary>
            <p v-if="member.patchedMember.details.requiresFinancialSupport?.value" class="style-description-small">
                {{ $t('Ingeschakeld') }}
            </p>
        </template>
        <EditMemberFinancialSupportBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>

    <CategorizedBox v-for="category of recordCategories.categories" :key="category.id" :icon="category.icon" :title="getRecordCategoryTitle(category)">
        <EditMemberRecordCategoryBox v-bind="$attrs" :member="member" :is-admin="recordCategories.adminPermissionsMap.get(category.id) ?? false" :category="category" :level="0" :validator="validator" />
    </CategorizedBox>

    <CategorizedBox v-if="app !== 'registration'" icon="feedback-line" :title="$t('%Ve')">
        <EditMemberNotesBox v-bind="$attrs" :member="member" :validator="validator" :level="0" />
    </CategorizedBox>
</template>

<script setup lang="ts">
import type { PlatformMember, RecordCategory } from '@stamhoofd/structures';
import { PermissionLevel } from '@stamhoofd/structures';

import { useDataPermissionSettings } from '#groups/hooks/useDataPermissionSettings.ts';
import { useFinancialSupportSettings } from '#groups/hooks/useFinancialSupportSettings.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import CategorizedBox from '#layout/categorized-view/CategorizedBox.vue';
import { computed } from 'vue';
import { useAppContext } from '../../../context/appContext';
import type { ErrorBox } from '../../../errors/ErrorBox';
import type { Validator } from '../../../errors/Validator';
import { useIsPropertyEnabled } from '../../hooks/useIsPropertyRequired';
import EditEmergencyContactsBox from './EditEmergencyContactsBox.vue';
import EditMemberDataPermissionsBox from './EditMemberDataPermissionsBox.vue';
import EditMemberFinancialSupportBox from './EditMemberFinancialSupportBox.vue';
import EditMemberGeneralBox from './EditMemberGeneralBox.vue';
import EditMemberNotesBox from './EditMemberNotesBox.vue';
import EditMemberParentsBox from './EditMemberParentsBox.vue';
import EditMemberRecordCategoryBox from './EditMemberRecordCategoryBox.vue';
import EditMemberTaxCertificateBox from './EditMemberTaxCertificateBox.vue';
import EditMemberUitpasBox from './EditMemberUitpasBox.vue';
import { getRecordCategoryTitleSuffix } from './recordCategoryTitleSuffix';

defineOptions({
    inheritAttrs: false,
});

// Meant to be rendered inside a CategorizedView (MemberStepView with categorized: true), which renders the title.
// title and level stay declared so they are not forwarded to the boxes through $attrs.
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
const isAdmin = app === 'dashboard' || app === 'admin';
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), true);
const organization = useOrganization();
const { dataPermissionSettings } = useDataPermissionSettings();
const { financialSupportSettings } = useFinancialSupportSettings();

const recordCategories = computed(() =>
    props.member.getEnabledRecordCategories({
        checkPermissions: {
            user: auth.user!,
            level: PermissionLevel.Write,
        },
        scopeOrganization: organization.value,
    }),
);

function getRecordCategoryTitle(category: RecordCategory) {
    const suffix = getRecordCategoryTitleSuffix({ member: props.member, category, app, organization: organization.value });
    return suffix ? `${category.name.toString()} (${suffix})` : category.name.toString();
}
</script>
