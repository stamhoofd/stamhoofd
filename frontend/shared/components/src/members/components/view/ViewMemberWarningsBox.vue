<template>
    <div v-if="hasWarnings" class="hover-box container">
        <hr>
        <ul class="member-records">
            <li
                v-for="warning in sortedWarnings"
                :key="warning.id"
                :class="{ [warning.type]: true }"
            >
                <span :class="'icon '+warning.icon" />
                <span class="text">{{ warning.text }}</span>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { DataPermissionsSettings, FinancialSupportSettings, PermissionLevel, PlatformMember, RecordWarning, RecordWarningType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useAuth, useOrganization, usePlatform } from '../../../hooks';
import { useIsPropertyEnabled } from '../../hooks/useIsPropertyRequired';
import { useTranslate } from '@stamhoofd/frontend-i18n';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()
const organization = useOrganization();
const platform = usePlatform();
const auth = useAuth();
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), false);
const $t = useTranslate()

// Possible the member didn't fill in the answers yet
const autoCompletedAnswers = computed(() => {
    const recordCategories = props.member.getEnabledRecordCategories({
        checkPermissions: {
            permissions: auth.userPermissions, 
            level: PermissionLevel.Read
        },
        scopeOrganization: organization.value
    });
    const allRecords = recordCategories.flatMap(category => category.getAllFilteredRecords(props.member));
    const answerClone = new Map(props.member.patchedMember.details.recordAnswers);

    for (const record of allRecords) {
        if (!answerClone.has(record.id)) {
            answerClone.set(record.id, record.createDefaultAnswer())
        }
    }

    return answerClone
});

const warnings = computed(() => {
    const warnings: RecordWarning[] = []

    for (const answer of autoCompletedAnswers.value.values()) {
        warnings.push(...answer.getWarnings())
    }

    if (isPropertyEnabled('financialSupport')) {
        if (props.member.patchedMember.details.requiresFinancialSupport && props.member.patchedMember.details.requiresFinancialSupport.value) {
            warnings.push(RecordWarning.create({
                text: platform.value.config.recordsConfiguration.financialSupport?.warningText ?? organization.value?.meta.recordsConfiguration.financialSupport?.warningText ?? FinancialSupportSettings.defaultWarningText,
                type: RecordWarningType.Error
            }))
        }
    }
    
    if (isPropertyEnabled('dataPermission')) {
        if (props.member.patchedMember.details.dataPermissions && !props.member.patchedMember.details.dataPermissions.value) {
            warnings.push(RecordWarning.create({
                text: platform.value.config.recordsConfiguration.dataPermission?.warningText ?? organization.value?.meta.recordsConfiguration.dataPermission?.warningText ?? DataPermissionsSettings.defaultWarningText,
                type: RecordWarningType.Error
            }))
        }
    }

    if (props.member.member.platformMemberships.length === 0) {
        warnings.push(RecordWarning.create({
            text: $t('shared.noMembershipWarning'),
            type: RecordWarningType.Error
        }))
    }

    return warnings
});
const hasWarnings = computed(() => warnings.value.length > 0);
const sortedWarnings = computed(() => warnings.value.slice().sort(RecordWarning.sort))
</script>

