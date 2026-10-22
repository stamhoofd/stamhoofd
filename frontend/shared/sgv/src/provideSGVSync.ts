import { useAuth } from '@stamhoofd/components/hooks/useAuth';
import { useOrganization } from '@stamhoofd/components/hooks/useOrganization';
import { useProvideSGVSyncFactory } from '@stamhoofd/components/members/sgvSync';
import { RecordWarning, RecordWarningType, SGVSyncStatus, TranslatedString } from '@stamhoofd/structures';
import { computed, toValue } from 'vue';
import { isMemberManaged } from './SGVSyncReport.ts';
import { useSGVSync } from './useSGVSync.ts';

export function useProvideSGVSync() {
    useProvideSGVSyncFactory((members, organizationOverride) => {
        const sync = useSGVSync(members, organizationOverride);
        const auth = useAuth();
        const organizationScope = useOrganization();
        const organization = computed(() => organizationOverride ? toValue(organizationOverride) : organizationScope.value);
        const sgvSyncMemberWarnings = computed(() => {
            const warnings: RecordWarning[] = [];
            if (!organization.value?.isSGVSyncOrganization) {
                return warnings;
            }
            const actionText = auth.hasFullAccess() ? $t('%1Z6') : $t('%1b9');
            for (const member of members ? toValue(members) : []) {
                if (!isMemberManaged(member, organization.value)) {
                    continue;
                }
                const status = member.getSGVSyncStatus({ organization: organization.value });
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

        function sgvSyncHandleWarningClick(warning: RecordWarning) {
            if (!auth.hasFullAccess() || !sgvSyncMemberWarnings.value.includes(warning)) {
                return;
            }
            sync.sgvSyncOpen().catch(console.error);
        }

        return {
            ...sync,
            sgvSyncMemberWarnings,
            sgvSyncHandleWarningClick,
        };
    });
}
