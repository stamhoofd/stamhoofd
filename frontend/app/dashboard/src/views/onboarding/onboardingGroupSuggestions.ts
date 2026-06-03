import { OrganizationType, OrganizationTypeHelper, UmbrellaOrganization } from '@stamhoofd/structures';

/**
 * Returns a basic list of suggested subdivision / age group names for a given organization
 * type and umbrella organization. These are only used to pre-fill the onboarding subdivisions
 * step when the organization doesn't have any groups yet, so users can get started quickly.
 *
 * Intentionally basic and easy to extend.
 */
export function getSuggestedGroupNames(type: OrganizationType, umbrella: UmbrellaOrganization | null): string[] {
    if (type === OrganizationType.Youth) {
        switch (umbrella) {
            case UmbrellaOrganization.ScoutsEnGidsenVlaanderen:
                return [$t('Kapoenen'), $t('Wouters'), $t('Jonggivers'), $t('Givers'), $t('Jin')];
            case UmbrellaOrganization.ChiroNationaal:
                return [$t('Ribbels'), $t('Speelclub'), $t('Rakwi'), $t('Tito'), $t('Keti'), $t('Aspi')];
            case UmbrellaOrganization.KSA:
                return [$t('Sloebers'), $t('Pagadders'), $t('Jonghernieuwers'), $t('Hernieuwers'), $t('Jongknapen'), $t('Knapen')];
            case UmbrellaOrganization.KLJ:
                return [$t('-12'), $t('+12'), $t('-16'), $t('+16')];
            default:
                return [$t('Leden')];
        }
    }

    if (OrganizationTypeHelper.getCategory(type) === OrganizationTypeHelper.getCategory(OrganizationType.Sport)) {
        return [$t('Recreanten'), $t('Competitie')];
    }

    return [$t('Leden')];
}
