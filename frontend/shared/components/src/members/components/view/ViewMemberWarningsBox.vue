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
import { useTranslate } from '@stamhoofd/frontend-i18n';
import { MembershipStatus, PermissionLevel, PlatformMember, RecordAnswer, RecordCategory, RecordWarning, RecordWarningType } from '@stamhoofd/structures';
import { computed } from 'vue';
import { useDataPermissionSettings, useFinancialSupportSettings } from '../../../groups';
import { useAuth, useOrganization } from '../../../hooks';
import { useIsPropertyEnabled } from '../../hooks/useIsPropertyRequired';

defineOptions({
    inheritAttrs: false,
});

const props = defineProps<{
    member: PlatformMember;
}>();
const organization = useOrganization();
const auth = useAuth();
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), false);
const $t = useTranslate();

// Possible the member didn't fill in the answers yet
const autoCompletedAnswers = computed(() => {
    const recordCategories = props.member.getEnabledRecordCategories({
        checkPermissions: {
            permissions: auth.userPermissions,
            level: PermissionLevel.Read,
        },
        scopeOrganization: organization.value,
    });
    const allRecords = recordCategories.flatMap(category => category.getAllFilteredRecords(props.member));
    const answerClone: typeof props.member.patchedMember.details.recordAnswers = new Map();

    for (const record of allRecords) {
        const answer = props.member.patchedMember.details.recordAnswers.get(record.id);
        if (!answer) {
            answerClone.set(record.id, RecordAnswer.createDefaultAnswer(record));
        }
        else {
            answerClone.set(record.id, answer);
        }
    }

    return answerClone;
});

const { financialSupportSettings } = useFinancialSupportSettings();
const { dataPermissionSettings } = useDataPermissionSettings();

const warnings = computed(() => {
    const warnings: RecordWarning[] = [];

    for (const answer of autoCompletedAnswers.value.values()) {
        warnings.push(...answer.getWarnings());
    }

    if (isPropertyEnabled('financialSupport')) {
        if (props.member.patchedMember.details.requiresFinancialSupport && props.member.patchedMember.details.requiresFinancialSupport.value) {
            warnings.push(RecordWarning.create({
                text: financialSupportSettings.value.warningText,
                type: RecordWarningType.Error,
            }));
        }
    }

    if (isPropertyEnabled('dataPermission')) {
        if (props.member.patchedMember.details.dataPermissions && !props.member.patchedMember.details.dataPermissions.value) {
            warnings.push(RecordWarning.create({
                text: dataPermissionSettings.value.warningText,
                type: RecordWarningType.Error,
            }));
        }
    }

    if (props.member.membershipStatus === MembershipStatus.Trial) {
        warnings.push(RecordWarning.create({
            text: $t('29343dad-93c5-4e72-a6d5-3960cfbfcf42'),
            type: RecordWarningType.Info,
        }));
    }

    if (props.member.membershipStatus === MembershipStatus.Inactive) {
        warnings.push(RecordWarning.create({
            text: $t('60871aaf-1b90-4a7c-a755-a4aeb0585a8e'),
            type: RecordWarningType.Error,
        }));
    }

    if (props.member.membershipStatus === MembershipStatus.Expiring) {
        warnings.push(RecordWarning.create({
            text: $t('1af084bf-42d6-4a59-a7da-d1e87c6dba8e'),
            type: RecordWarningType.Warning,
        }));
    }

    return warnings;
});
const hasWarnings = computed(() => warnings.value.length > 0);
const sortedWarnings = computed(() => warnings.value.slice().sort(RecordWarning.sort));
</script>
