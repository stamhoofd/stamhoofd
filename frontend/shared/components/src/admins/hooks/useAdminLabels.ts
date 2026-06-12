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
        adminRolesTitle: computed(() => showInternalAdmins.value ? $t('Externe beheerdersrollen') : $t('Beheerdersrollen')),
        // 'Externe beheerders' / 'Beheerders'
        adminsTitle: computed(() => showInternalAdmins.value ? $t('Externe beheerders') : $t('Beheerders')),
        // 'Externe beheerder toevoegen' / 'Beheerder toevoegen'
        addAdminTitle: computed(() => showInternalAdmins.value ? $t('Externe beheerder toevoegen') : $t('Beheerder toevoegen')),
        // 'Externe beheerder bewerken' / 'Beheerder bewerken'
        editAdminTitle: computed(() => showInternalAdmins.value ? $t('Externe beheerder bewerken') : $t('Beheerder bewerken')),
        // Description shown above the admins list (ExternalAdminsBox)
        adminsDescription: computed(() => showInternalAdmins.value
            ? $t('%Yg')
            : $t('Beheerders hebben een account waarmee ze toegang krijgen tot Stamhoofd.')),
        // Empty-state shown when there are no admins yet (ExternalAdminsBox)
        adminsEmptyDescription: computed(() => showInternalAdmins.value
            ? $t('%Yh')
            : $t('Er zijn nog geen beheerders. Nodig iemand uit om beheerder te worden.')),
        // Description shown above the roles list (RolesView)
        adminRolesDescription: computed(() => showInternalAdmins.value
            ? $t('%3I')
            : $t('Maak beheerdersrollen aan en ken die vervolgens toe aan je beheerders om hun toegang te bepalen.')),
        // Description shown above the roles of a single administrator (EditAdminView)
        adminRolesPersonDescription: computed(() => showInternalAdmins.value
            ? $t('%Yq')
            : $t('Je kan een beheerder verschillende rollen toekennen. Een beheerder zonder rollen heeft geen enkele toegang.')),
        // Description shown above the roles list of a resource, e.g. a webshop or group (EditResourceRolesView)
        resourceAdminRolesDescription: computed(() => showInternalAdmins.value
            ? $t('%Yw')
            : $t('Je kan toegang geven aan beheerders via beheerdersrollen.')),
        // Description shown above the roles of an API-key (ApiUserView)
        apiUserRolesDescription: computed(() => showInternalAdmins.value
            ? $t('%Jn')
            : $t('Je kan een API-key verschillende rollen geven, net zoals een beheerder. Hiermee kan je jouw key beter beveiligen en enkel toegang geven waarvoor je het nodig hebt.')),
    };
}
