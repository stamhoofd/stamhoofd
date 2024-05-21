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

        <template v-if="member.patchedMember.users.length > 0">
            <hr>
        </template>
    </div>
</template>

<script setup lang="ts">
import { DataPermissionsSettings, FinancialSupportSettings, PlatformMember, RecordWarning, RecordWarningType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useOrganization, usePlatform } from '../../../hooks';

defineOptions({
    inheritAttrs: false
})

const props = defineProps<{
    member: PlatformMember
}>()
const organization = useOrganization();
const platform = usePlatform();

const warnings = computed(() => {
    const warnings: RecordWarning[] = []

    for (const answer of props.member.patchedMember.details.recordAnswers.values()) {
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
    
    if ((platform.value && platform.value.config.recordsConfiguration.financialSupport) || (organization.value && organization.value.meta.recordsConfiguration.dataPermission)) {
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

