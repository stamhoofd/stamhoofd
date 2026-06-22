import { computed } from 'vue';
import { useShowInternalAdmins } from './useShowInternalAdmins';

/**
 * Labels for administrators and admin roles.
 *
 * When internal administrators (members with functions) are enabled, external administrators are a separate concept,
 * so we keep the 'externe beheerders(rollen)' naming. When internal administrators are disabled, there is only one kind
 * of administrator, so we drop the 'externe' prefix and simply use 'beheerders(rollen)'.
 */
export function useAdminLabels() {
    const showInternalAdmins = useShowInternalAdmins();

    return {
        // 'Externe beheerdersrollen' / 'Beheerdersrollen'
        adminRolesTitle: computed(() => showInternalAdmins.value ? $t('%Jm') : $t('%1WC')),
        // 'Externe beheerders' / 'Beheerders'
        adminsTitle: computed(() => showInternalAdmins.value ? $t('%Yf') : $t('%K5')),
        // 'Externe beheerder toevoegen' / 'Beheerder toevoegen'
        addAdminTitle: computed(() => showInternalAdmins.value ? $t('%Yk') : $t('%1Vr')),
        // 'Externe beheerder bewerken' / 'Beheerder bewerken'
        editAdminTitle: computed(() => showInternalAdmins.value ? $t('%Yl') : $t('%1cC')),
        // Description shown above the admins list (ExternalAdminsBox)
        adminsDescription: computed(() => showInternalAdmins.value
            ? $t('%Yg')
            : $t('%1WX')),
        // Empty-state shown when there are no admins yet (ExternalAdminsBox)
        adminsEmptyDescription: computed(() => showInternalAdmins.value
            ? $t('%1V5')
            : $t('%1dF')),
        // Description shown above the roles list (RolesView)
        adminRolesDescription: computed(() => showInternalAdmins.value
            ? $t('%3I')
            : $t('%1aY')),
        // Description shown above the roles of a single administrator (EditAdminView)
        adminRolesPersonDescription: computed(() => showInternalAdmins.value
            ? $t('%Yq')
            : $t('%1bL')),
        // Description shown above the roles list of a resource, e.g. a webshop or group (EditResourceRolesView)
        resourceAdminRolesDescription: computed(() => showInternalAdmins.value
            ? $t('%Yw')
            : $t('%1Vx')),
        // Description shown above the roles of an API-key (ApiUserView)
        apiUserRolesDescription: computed(() => showInternalAdmins.value
            ? $t('%Jn')
            : $t('%1Y3')),
    };
}
