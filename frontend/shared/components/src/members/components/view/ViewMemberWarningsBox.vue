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

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()
const organization = useOrganization();
const platform = usePlatform();
const auth = useAuth();

// Possible the member didn't fill in the answers yet
const autoCompletedAnswers = computed(() => {
    const recordCategories = props.member.getEnabledRecordCategories(auth.userPermissions, PermissionLevel.Read, organization.value);
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

    if ((platform.value && platform.value.config.recordsConfiguration.financialSupport) || (organization.value && organization.value.meta.recordsConfiguration.financialSupport)) {
        if (props.member.patchedMember.details.requiresFinancialSupport && props.member.patchedMember.details.requiresFinancialSupport.value) {
            warnings.push(RecordWarning.create({
                text: platform.value.config.recordsConfiguration.financialSupport?.warningText ?? organization.value?.meta.recordsConfiguration.financialSupport?.warningText ?? FinancialSupportSettings.defaultWarningText,
                type: RecordWarningType.Error
            }))
        }
    }
    
    if ((platform.value && platform.value.config.recordsConfiguration.dataPermission) || (organization.value && organization.value.meta.recordsConfiguration.dataPermission)) {
        if (props.member.patchedMember.details.dataPermissions && !props.member.patchedMember.details.dataPermissions.value) {
            warnings.push(RecordWarning.create({
                text: platform.value.config.recordsConfiguration.dataPermission?.warningText ?? organization.value?.meta.recordsConfiguration.dataPermission?.warningText ?? DataPermissionsSettings.defaultWarningText,
                type: RecordWarningType.Error
            }))
        }
    }

    return warnings
});
const hasWarnings = computed(() => warnings.value.length > 0);
const sortedWarnings = computed(() => warnings.value.slice().sort(RecordWarning.sort))
</script>

