import type { AuditLogCustomRenderers } from '@stamhoofd/components/audit-logs/components/RenderTextComponent';
import { AuditLogReplacementType } from '@stamhoofd/structures';
import { h } from 'vue';
import { useShowOrganization } from './useShowOrganization';

/**
 * Custom audit-log renderers specific to the admin app. These plug app-specific behaviour (such as
 * opening an organization) into the shared audit-log components without the shared package depending
 * on the admin app.
 */
export function useAdminAuditLogRenderers(): AuditLogCustomRenderers {
    return {
        [AuditLogReplacementType.Organization]: (obj) => {
            if (!obj.id) {
                return undefined;
            }
            const showOrganization = useShowOrganization();
            return () => h('button', {
                class: 'style-inline-resource button simple',
                onClick: () => showOrganization(obj.id!),
                type: 'button',
            }, obj.value);
        },
    };
}
