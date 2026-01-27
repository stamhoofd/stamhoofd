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
import { MemberPlatformMembership, MembershipStatus, PermissionLevel, PlatformMember, RecordAnswer, RecordWarning, RecordWarningType, TranslatedString } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
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
const auth = useAuth();
const isPropertyEnabled = useIsPropertyEnabled(computed(() => props.member), false);
const organization = useOrganization();

// Possible the member didn't fill in the answers yet
const autoCompletedAnswers = computed(() => {
    const { categories: recordCategories } = props.member.getEnabledRecordCategories({
        checkPermissions: {
            user: auth.user!,
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
        if (props.member.patchedMember.details.shouldApplyReducedPrice) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create(financialSupportSettings.value.warningText),
                type: RecordWarningType.Info,
            }));
        }
    }

    if (isPropertyEnabled('dataPermission')) {
        if (props.member.patchedMember.details.dataPermissions && !props.member.patchedMember.details.dataPermissions.value) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create(dataPermissionSettings.value.warningText),
                type: RecordWarningType.Error,
            }));
        }
    }

    if (isPropertyEnabled('parents') && props.member.patchedMember.details.parents.length > 0) {
        if (props.member.patchedMember.details.parentsHaveAccess?.value === true) {
            if (props.member.patchedMember.details.defaultAge < 18) {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('aeeeb5ba-7576-497c-a40e-8bc48338b2a7')),
                    type: RecordWarningType.Info,
                }));
            }
            else {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('54bdf92a-7ff9-46ba-a944-2422f4b84f80')),
                    type: RecordWarningType.Info,
                }));
            }
        }
        else if (props.member.patchedMember.details.parentsHaveAccess?.value === false) {
            if (props.member.patchedMember.details.defaultAge < 18) {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('9ce4a6f7-81ec-4dba-aac5-5d497d33a274')),
                    type: RecordWarningType.Info,
                }));
            }
        }
    }

    if (props.member.membershipStatus === MembershipStatus.Trial) {
        warnings.push(RecordWarning.create({
            text: TranslatedString.create($t('29343dad-93c5-4e72-a6d5-3960cfbfcf42')),
            type: RecordWarningType.Info,
        }));
    }

    if (props.member.membershipStatus === MembershipStatus.Inactive) {
        // todo: check when temporal membership
        const nextMembership = getNextMembership();

        if (nextMembership) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('880e4cac-5a7e-4d6d-80ad-c5472a005df6', { date: Formatter.date(nextMembership.startDate) })),
                type: RecordWarningType.Warning,
            }));
        }
        else {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('60871aaf-1b90-4a7c-a755-a4aeb0585a8e')),
                type: RecordWarningType.Error,
            }));
        }
    }

    if (props.member.membershipStatus === MembershipStatus.Expiring) {
        warnings.push(RecordWarning.create({
            text: TranslatedString.create($t('1af084bf-42d6-4a59-a7da-d1e87c6dba8e')),
            type: RecordWarningType.Warning,
        }));
    }

    return warnings;
});
const hasWarnings = computed(() => warnings.value.length > 0);
const sortedWarnings = computed(() => warnings.value.slice().sort(RecordWarning.sort));

const getNextMembership = (): MemberPlatformMembership | null => {
    const now = new Date().getTime();
    const nextMemberships = [...props.member.member.platformMemberships]
        .filter(m => m.startDate.getTime() >= now)
        .sort((a, b) => Sorter.stack(
            Sorter.byDateValue(b.startDate, a.startDate),
            Sorter.byDateValue(b.createdAt, a.createdAt),
        ));

    if (nextMemberships.length > 0) {
        return nextMemberships[0];
    }//

    return null;
};
</script>
