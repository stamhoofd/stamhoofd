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
                return [$t('%1c7'), $t('%1Wf'), $t('%1ZD'), $t('%1VZ'), $t('%1Xs')];
            case UmbrellaOrganization.ChiroNationaal:
                return [$t('%1Zg'), $t('%1aQ'), $t('%1cH'), $t('%1a9'), $t('%1aw'), $t('%1bc')];
            case UmbrellaOrganization.KSA:
                return [$t('%1bI'), $t('%1Zn'), $t('%1YY'), $t('%1Zr'), $t('%1Ui'), $t('%1XS')];
            case UmbrellaOrganization.KLJ:
                return [$t('%1Yk'), $t('%1bs'), $t('%1a6'), $t('%1Y9')];
            default:
                return [$t('%1EH')];
        }
    }

    if (OrganizationTypeHelper.getCategory(type) === OrganizationTypeHelper.getCategory(OrganizationType.Sport)) {
        return [$t('%1ao'), $t('%1bU')];
    }

    return [$t('%1EH')];
}
