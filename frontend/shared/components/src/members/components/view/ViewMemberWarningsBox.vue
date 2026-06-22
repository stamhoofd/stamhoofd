<template>
    <div v-if="hasWarnings" class="hover-box container">
        <hr>
        <ul class="member-records">
            <li
                v-for="warning in sortedWarnings"
                :key="warning.id"
                :class="{ [warning.type]: true }"
                @click="handleWarningClick(warning)"
            >
                <span :class="'icon '+warning.icon" />
                <span class="text">{{ warning.text }}</span>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { useDataPermissionSettings } from '#groups/hooks/useDataPermissionSettings.ts';
import { useFinancialSupportSettings } from '#groups/hooks/useFinancialSupportSettings.ts';
import { useAuth } from '#hooks/useAuth.ts';
import { useOrganization } from '#hooks/useOrganization.ts';
import { isMemberManaged } from '@stamhoofd/sgv-frontend/SGVSyncReport';
import { useSGVSync } from '@stamhoofd/sgv-frontend/useSGVSync';
import type { MemberPlatformMembership, PlatformMember } from '@stamhoofd/structures';
import { MembershipStatus, PermissionLevel, RecordAnswer, RecordWarning, RecordWarningType, SGVSyncStatus, TranslatedString } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';
import { computed } from 'vue';
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
const { sgvSyncOpen } = useSGVSync(computed(() => [props.member.member]));

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
        } else {
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
                    text: TranslatedString.create($t('%1Hh')),
                    type: RecordWarningType.Info,
                }));
            } else {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('%1Hi')),
                    type: RecordWarningType.Info,
                }));
            }
        } else if (props.member.patchedMember.details.parentsHaveAccess?.value === false) {
            if (props.member.patchedMember.details.defaultAge < 18) {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('%1Hj')),
                    type: RecordWarningType.Info,
                }));
            }
        }
    }

    if (STAMHOOFD.userMode === 'platform') {
        if (props.member.membershipStatus === MembershipStatus.Trial) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('%7z')),
                type: RecordWarningType.Info,
            }));
        }

        if (props.member.membershipStatus === MembershipStatus.Inactive) {
        // todo: check when temporal membership
            const nextMembership = getNextMembership();

            if (nextMembership) {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('%Bh', { date: Formatter.date(nextMembership.startDate) })),
                    type: RecordWarningType.Warning,
                }));
            } else {
                warnings.push(RecordWarning.create({
                    text: TranslatedString.create($t('%5C')),
                    type: RecordWarningType.Error,
                }));
            }
        }

        if (props.member.membershipStatus === MembershipStatus.Expiring) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('%5B')),
                type: RecordWarningType.Warning,
            }));
        }
    }

    if (organization.value?.isSGVSyncOrganization && isMemberManaged(props.member.member, organization.value)) {
        const status = props.member.member.getSGVSyncStatus({ organization: organization.value });
        const actionText = auth.hasFullAccess() ? $t('%1Z6') : $t('%1b9');

        if (status === SGVSyncStatus.Never) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('%1Xa', { action: actionText })),
                type: RecordWarningType.Error,
            }));
        } else if (status === SGVSyncStatus.Outdated) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('%1Us', { action: actionText })),
                type: RecordWarningType.Warning,
            }));
        } else if (status === SGVSyncStatus.Changed) {
            warnings.push(RecordWarning.create({
                text: TranslatedString.create($t('%1X3', { action: actionText })),
                type: RecordWarningType.Info,
            }));
        }
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
function handleWarningClick(warning: RecordWarning) {
    if (!auth.hasFullAccess() || !organization.value || !isMemberManaged(props.member.member, organization.value)) {
        return;
    }

    const status = props.member.member.getSGVSyncStatus({ organization: organization.value });
    if (status === SGVSyncStatus.Never || status === SGVSyncStatus.Outdated || status === SGVSyncStatus.Changed) {
        const text = warning.text.toString();
        if (text.includes('groepsadministratie') || text.includes('synchronisatie')) {
            sgvSyncOpen().catch(console.error);
        }
    }
}
</script>
