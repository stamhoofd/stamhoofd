import type { GroupCategory, Organization, OrganizationRegistrationPeriod } from '@stamhoofd/structures';
import { Group, GroupGenderType, GroupPrivateSettings, GroupSettings, GroupStatus, GroupType, OrganizationGenderType, TranslatedString } from '@stamhoofd/structures';

/**
 * Holds the information that is shared across the steps of the member administration
 * onboarding flow and exposes a few helpers the steps rely on.
 *
 * Every step persists its changes to the server as soon as the user continues, so the
 * organization in this view model (a live, in-place updated reference) always reflects the
 * latest saved state. That is also what makes it possible to resume the flow after a reload.
 */
export class MemberAdministrationOnboardingViewModel {
    organization: Organization;

    constructor({ organization }: { organization: Organization }) {
        this.organization = organization;
    }

    /**
     * The organization registration period the onboarding is configuring (the current work year).
     */
    get period(): OrganizationRegistrationPeriod {
        return this.organization.period;
    }

    /**
     * All membership groups of the current period, in category-tree order.
     */
    get membershipGroups(): Group[] {
        return this.period.adminCategoryTree
            .getAllGroups()
            .filter(g => g.type === GroupType.Membership && g.deletedAt === null);
    }

    /**
     * The category new onboarding groups should be added to. We descend into the first child
     * category until we reach a leaf, because the backend doesn't allow a category to contain
     * both groups and subcategories.
     */
    getMainCategory(): GroupCategory {
        const categories = this.period.settings.categories;
        let category = this.period.rootCategory ?? categories[0];

        while (category && category.categoryIds.length > 0) {
            const child = categories.find(c => c.id === category!.categoryIds[0]);
            if (!child) {
                break;
            }
            category = child;
        }

        return category;
    }

    /**
     * Creates a new (unsaved) membership group for the current period.
     */
    createGroup(name: string): Group {
        return Group.create({
            organizationId: this.organization.id,
            periodId: this.period.period.id,
            type: GroupType.Membership,
            status: GroupStatus.Closed,
            settings: GroupSettings.create({
                name: TranslatedString.create(name),
                genderType: this.organization.meta.genderType === OrganizationGenderType.Mixed ? GroupGenderType.Mixed : GroupGenderType.OnlyFemale,
            }),
            privateSettings: GroupPrivateSettings.create({}),
        });
    }
}
