import { ArrayDecoder, AutoEncoder, BooleanDecoder, DateDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Address } from './addresses/Address.js';
import { appToUri } from './AppType.js';
import { compileToInMemoryFilter } from './filters/InMemoryFilter.js';
import { organizationItemInMemoryFilterCompilers } from './filters/inMemoryFilterDefinitions.js';
import { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { Group } from './Group.js';
import { GroupCategoryTree } from './GroupCategory.js';
import { ObjectWithRecords, PatchAnswers } from './members/ObjectWithRecords.js';
import { RecordAnswer } from './members/records/RecordAnswer.js';
import { RecordSettings } from './members/records/RecordSettings.js';
import { OrganizationMetaData } from './OrganizationMetaData.js';
import { OrganizationPrivateMetaData } from './OrganizationPrivateMetaData.js';
import { OrganizationRegistrationPeriod, RegistrationPeriod, RegistrationPeriodList } from './RegistrationPeriod.js';
import { Webshop, WebshopPreview } from './webshops/Webshop.js';
import { User } from './User.js';
import { Company } from './Company.js';
import { Language } from './Language.js';

export class BaseOrganization extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    /**
     * Name of the organization you are creating
     */
    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: BooleanDecoder, version: 325 })
    active = true;

    @field({ decoder: StringDecoder, nullable: true, version: 3, upgrade: () => null })
    website: string | null = null;

    @field({ decoder: StringDecoder, nullable: true, version: 3, upgrade: () => null })
    registerDomain: string | null = null;

    @field({ decoder: StringDecoder, version: 3, upgrade: () => '' })
    uri = '';

    @field({ decoder: OrganizationMetaData, defaultValue: () => OrganizationMetaData.create({}) })
    meta: OrganizationMetaData;

    @field({ decoder: Address })
    address = Address.create({});

    @field({ decoder: DateDecoder, version: 259 })
    createdAt = new Date();

    /**
     * Return default locale confiruation
     */
    get i18n() {
        return { language: Language.Dutch, locale: 'nl-' + this.address.country };
    }

    /**
     * Potentially includes a path
     */
    getRegistrationUrl(i18n?: { language: Language; locale: string }): string {
        if (this.registerDomain) {
            let d = this.registerDomain;

            if (i18n && i18n.language !== this.i18n.language) {
                d += '/' + i18n.language;
            }

            return d;
        }
        return this.getDefaultRegistrationUrl(i18n);
    }

    getDefaultRegistrationUrl(i18n?: { language: Language; locale: string }): string {
        if (!STAMHOOFD.domains.registration) {
            return STAMHOOFD.domains.dashboard + '/' + (i18n?.locale ?? this.i18n.locale) + '/' + appToUri('registration') + '/' + this.uri;
        }
        let defaultDomain = STAMHOOFD.domains.registration[this.address.country] ?? STAMHOOFD.domains.registration[''];

        if (i18n && i18n.language !== this.i18n.language) {
            defaultDomain += '/' + i18n.language;
        }

        return this.uri + '.' + defaultDomain;
    }

    /**
     * Used for redirecting
     */
    get resolvedRegisterDomain() {
        if (this.registerDomain) {
            return this.registerDomain;
        }

        if (!STAMHOOFD.domains.registration) {
            return null;
        }

        return this.uri + '.' + (STAMHOOFD.domains.registration[this.address.country] ?? STAMHOOFD.domains.registration['']);
    }

    get registerUrl() {
        return this.getRegistrationUrl();
    }

    get dashboardUrl() {
        return 'https://' + STAMHOOFD.domains.dashboard + '/' + appToUri('dashboard') + '/' + this.uri;
    }

    get dashboardDomain(): string {
        return STAMHOOFD.domains.dashboard;
    }

    /**
     * Assures at least one company at all times
     */
    get defaultCompanies() {
        return this.meta.companies.length
            ? this.meta.companies
            : [
                    Company.create({
                        name: this.name,
                        address: this.address,
                    }),
                ];
    }
}

export class Organization extends BaseOrganization implements ObjectWithRecords {
    /**
     * @deprecated
     * Please use period instead now
     */
    @field({ decoder: new ArrayDecoder(Group), version: 2, upgrade: () => [], optional: true })
    groups: Group[] = [];

    @field({ decoder: OrganizationRegistrationPeriod, version: 264, defaultValue: () => OrganizationRegistrationPeriod.create({ period: RegistrationPeriod.create({}) }) })
    period: OrganizationRegistrationPeriod;

    /**
     * Get all groups that are in a category
     */
    get availableGroups() {
        return this.period.categoryTree.getAllGroups();
    }

    getGroupsForPermissions(permissions?: import('./LoadedPermissions.js').LoadedPermissions | null) {
        return this.getCategoryTree({ permissions }).getAllGroups();
    }

    get adminAvailableGroups() {
        return this.period.adminCategoryTree.getAllGroups();
    }

    /**
     * @deprecated
     *
     * Get all groups that are in a category
     */
    get availableCategories() {
        return this.period.availableCategories;
    }

    /**
     * @deprecated
     */
    get categoryTree(): GroupCategoryTree {
        return this.period.categoryTree;
    }

    /**
     * @deprecated
     */
    get publicCategoryTree(): GroupCategoryTree {
        return this.period.publicCategoryTree;
    }

    /**
     * @deprecated
     */
    get adminCategoryTree(): GroupCategoryTree {
        return this.getCategoryTree({ admin: true });
    }

    isAcceptingNewMembers(admin: boolean) {
        const allGroups = this.adminAvailableGroups; // we need to check admin groups because required groups could be restricted to internal groups
        const groups = this.getCategoryTree({ admin }).getAllGroups();

        for (const group of groups) {
            if (group.closed && !group.notYetOpen) {
                continue;
            }
            if (group.settings.requireGroupIds.length > 0 && group.settings.requireGroupIds.find(id => !!allGroups.find(g => g.id === id))) {
                continue;
            }

            if (group.settings.availableMembers === 0 && !group.waitingList) {
                continue;
            }
            return true;
        }
        return false;
    }

    isAcceptingExistingMembers(admin: boolean) {
        const groups = this.getCategoryTree({ admin }).getAllGroups();

        for (const group of groups) {
            if (group.closed) {
                continue;
            }
            if (group.settings.availableMembers === 0 && !group.waitingList) {
                continue;
            }
            return true;
        }
        return false;
    }

    /**
     * Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     *
     * For registration members perspective, try to use options.admin instead of options.permissions.
     * options.permissions is only used if you want to hide groups and empty categories that you don't have permissions for.
     */
    getCategoryTree(options?: { maxDepth?: number; filterGroups?: (group: Group) => boolean; permissions?: import('./LoadedPermissions.js').LoadedPermissions | null; smartCombine?: boolean; admin?: boolean }): GroupCategoryTree {
        return this.period.getCategoryTree(options ? { ...options, organization: this } : { organization: this });
    }

    /**
     * @deprecated
     * (todo) Contains the fully build hierarchy without the need for ID lookups. Try not to use this tree when modifying it.
     */
    getCategoryTreeWithDepth(maxDepth: number): GroupCategoryTree {
        return this.getCategoryTree({ maxDepth });
    }

    /**
     * Only set for users with full access to the organization
     */
    @field({ decoder: OrganizationPrivateMetaData, nullable: true, version: 6 })
    privateMeta: OrganizationPrivateMetaData | null = null;

    /**
     * Only set for users with full access to the organization
     */
    @field({ decoder: new ArrayDecoder(WebshopPreview), version: 38, upgrade: () => [] })
    webshops: WebshopPreview[] = [];

    /**
     * Only available for patching. Also available with lazy loading OrganizationAdmins
     */
    admins?: User[] | null = null;

    /**
     * Keep admins accessible and in memory
     */
    periods?: RegistrationPeriodList;

    isRecordEnabled(_record: RecordSettings): boolean {
        return true;
    }

    getRecordAnswers(): Map<string, RecordAnswer> {
        return this.privateMeta?.recordAnswers ?? new Map();
    }

    patchRecordAnswers(patch: PatchAnswers): this {
        return (this as Organization).patch({
            privateMeta: OrganizationPrivateMetaData.patch({
                recordAnswers: patch,
            }),
        }) as this;
    }

    doesMatchFilter(filter: StamhoofdFilter): boolean {
        try {
            const compiledFilter = compileToInMemoryFilter(filter, organizationItemInMemoryFilterCompilers);
            const value = compiledFilter(this);
            console.log('does match filter', filter, this, value);
            return value;
        }
        catch (e) {
            console.error('Error while compiling filter', e, filter);
        }
        return false;
    }

    updatePeriods(periods: OrganizationRegistrationPeriod[]) {
        // Update in memory
        for (const period of this.periods?.organizationPeriods ?? []) {
            const updated = periods.find(p => p.id === period.id);
            if (updated) {
                period.deepSet(updated);
            }
        }

        const updated = periods.find(p => p.id === this.period.id);
        if (updated) {
            this.period.deepSet(updated);
        }

        // Add missing periods
    }
}

export class OrganizationWithWebshop extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    @field({ decoder: Webshop })
    webshop: Webshop;
}

export class GetWebshopFromDomainResult extends AutoEncoder {
    @field({ decoder: Organization })
    organization: Organization;

    /**
     * There is one specific webshop for the given domain.
     */
    @field({ decoder: Webshop, nullable: true })
    webshop: Webshop | null = null;

    /**
     * Multiple webshops possible. Show a selection page.
     */
    @field({ decoder: new ArrayDecoder(WebshopPreview), version: 137 })
    webshops: WebshopPreview[] = [];
}
