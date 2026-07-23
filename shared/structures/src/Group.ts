import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Formatter } from '@stamhoofd/utility';
import type { AppType } from './AppType.js';
import type { Event } from './Event.js';
import type { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { getActivePeriodIds, getActivePeriods } from './getActivePeriods.js';
import type { GroupCategory } from './GroupCategory.js';
import { GroupGenderType } from './GroupGenderType.js';
import { GroupPrivateSettings } from './GroupPrivateSettings.js';
import { GroupSettings, WaitingListType } from './GroupSettings.js';
import { GroupType } from './GroupType.js';
import { Gender } from './members/Gender.js';
import type { Organization } from './Organization.js';
import { PermissionLevel } from './PermissionLevel.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { StockReservation } from './StockReservation.js';

export type GroupTagItem = {
    icon?: string;
    title: string;
    style?: 'error' | 'warn' | 'success';
};

export enum GroupStatus {
    Open = 'Open',
    Closed = 'Closed',

    /**
     * @deprecated
     */
    Archived = 'Archived',
}

export function getGroupStatusName(status: GroupStatus | 'RegistrationStartDate', startDate?: Date | null) {
    switch (status) {
        case GroupStatus.Open:
            return $t(`%1EN`);
        case GroupStatus.Closed:
            return $t(`%1PH`);
        case GroupStatus.Archived:
            return $t(`%1Pg`);
        case 'RegistrationStartDate': {
            if (startDate) {
                return $t('%kR', { date: Formatter.startDate(startDate) });
            }
            return $t('%1VH');
        }
    }
}

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(GroupType), version: 286 })
    type: GroupType = GroupType.Membership;

    @field({ decoder: StringDecoder, version: 250 })
    organizationId: string = '';

    @field({ decoder: StringDecoder, nullable: true, ...NextVersion })
    eventId: string | null;

    @field({ decoder: StringDecoder, version: 265 })
    periodId: string = '';

    @field({ decoder: StringDecoder, nullable: true, version: 267 })
    defaultAgeGroupId: string | null = null;

    @field({ decoder: Group, nullable: true, version: 292 })
    waitingList: Group | null = null;

    @field({ decoder: new ArrayDecoder(StockReservation), version: 298 })
    stockReservations: StockReservation[] = [];

    /**
     * @deprecated
     */
    @field({ decoder: IntegerDecoder })
    cycle = 0;

    @field({ decoder: GroupSettings })
    settings: GroupSettings = GroupSettings.create({});

    @field({ decoder: DateDecoder, version: 187 })
    createdAt: Date = new Date();

    @field({ decoder: DateDecoder, nullable: true, version: 187 })
    deletedAt: Date | null = null;

    /**
     * Only set when you have access to this information
     */
    @field({ decoder: GroupPrivateSettings, nullable: true, version: 10 })
    privateSettings: GroupPrivateSettings | null = null;

    /**
     * Manually close a group
     */
    @field({ decoder: new EnumDecoder(GroupStatus), version: 192 })
    status = GroupStatus.Open;

    // Permission checking cache:
    event: Event | null = null;

    // Permission checking cache (waiting list -> group -> event)
    parentGroup: Group | null = null;

    getDiffName() {
        return this.settings.name;
    }

    static defaultSort(this: unknown, a: Group, b: Group) {
        if (a.settings.maxAge && !b.settings.maxAge) {
            return -1;
        }
        if (b.settings.maxAge && !a.settings.maxAge) {
            return 1;
        }
        if (!b.settings.maxAge && !a.settings.maxAge) {
            // name
            return Group.nameSort(a, b);
        }
        if (a.settings.maxAge! > b.settings.maxAge!) {
            return 1;
        }
        if (a.settings.maxAge! < b.settings.maxAge!) {
            return -1;
        }
        return Group.nameSort(a, b);
    }

    static nameSort(this: unknown, a: Group, b: Group) {
        if (a.settings.name.toLowerCase() < b.settings.name.toLowerCase()) {
            return -1;
        }
        if (a.settings.name.toLowerCase() > b.settings.name.toLowerCase()) {
            return 1;
        }
        return 0;
    }

    getMemberCount() {
        return this.settings.getMemberCount();
    }

    /**
     * Return the pre registration date only if is is active right now
     */
    get activePreRegistrationDate() {
        return this.settings.activePreRegistrationDate;
    }

    /**
     * Closed now, but will open in the future
     */
    get notYetOpen() {
        return this.settings.notYetOpen;
    }

    /**
     * No registrations and waiting list registrations are possible if closed
     */
    get closed() {
        if (this.status !== GroupStatus.Open) {
            return true;
        }

        if (this.settings.notYetOpen) {
            // Start date or pre registration date are in the future
            return true;
        }

        const now = new Date();
        if (this.settings.registrationEndDate && this.settings.registrationEndDate < now) {
            return true;
        }

        return false;
    }

    trimmedName(categoryName: string) {
        const name = this.settings.name.toString();
        if (name.toLocaleLowerCase().startsWith(categoryName.toLocaleLowerCase())) {
            const cname = Formatter.capitalizeFirstLetter(Formatter.unwrapLeadingParentheses(name.slice(categoryName.length).trim()));
            if (cname.length) {
                return cname;
            }
        }

        return name;
    }

    /**
     * Returns all parent and grandparents of this group
     */
    getParentCategories(all: GroupCategory[], recursive = true): GroupCategory[] {
        const map = new Map<string, GroupCategory>();

        const parents = all.filter(g => g.groupIds.includes(this.id));
        for (const parent of parents) {
            map.set(parent.id, parent);

            if (recursive) {
                const hisParents = parent.getParentCategories(all);
                for (const pp of hisParents) {
                    map.set(pp.id, pp);
                }
            }
        }

        return [...map.values()];
    }

    hasAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | null, allCategories: GroupCategory[], permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!permissions) {
            return false;
        }

        if (permissions.hasResourceAccess(PermissionsResourceType.Groups, this.id, permissionLevel)) {
            return true;
        }

        // Check parent categories
        const parentCategories = this.getParentCategories(allCategories);
        for (const category of parentCategories) {
            if (permissions.hasResourceAccess(PermissionsResourceType.GroupCategories, category.id, permissionLevel)) {
                return true;
            }
        }

        return false;
    }

    isPublic(allCategories: GroupCategory[]): boolean {
        for (const parent of this.getParentCategories(allCategories)) {
            if (!parent.settings.public) {
                return false;
            }
        }
        return true;
    }

    hasReadAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | null, allCategories: GroupCategory[]): boolean {
        return this.hasAccess(permissions, allCategories, PermissionLevel.Read);
    }

    hasWriteAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | null, allCategories: GroupCategory[]): boolean {
        return this.hasAccess(permissions, allCategories, PermissionLevel.Write);
    }

    hasFullAccess(permissions: import('./LoadedPermissions.js').LoadedPermissions | null, allCategories: GroupCategory[]): boolean {
        return this.hasAccess(permissions, allCategories, PermissionLevel.Full);
    }

    get squareImage() {
        return this.settings.squarePhoto ?? this.settings.coverPhoto;
    }

    get dateRange() {
        if (this.type === GroupType.EventRegistration) {
            return Formatter.dateRange(this.settings.startDate, this.settings.endDate);
        }
        return this.settings.period?.nameShort ?? null;
    }

    /**
     * Return the period ids that we consider as active for a given
     * group and organization combination.
     */
    getActivePeriodIds(organization: Organization | null) {
        return getActivePeriodIds(this.periodId, organization);
    }

    /**
     * Return the period ids that we consider as active for a given
     * group and organization combination.
     */
    getActivePeriods(organization: Organization | null) {
        return getActivePeriods(this.settings.period ?? { id: this.periodId, name: $t('%8X') }, organization);
    }

    getRecommendedFilter(organization?: Organization | null): StamhoofdFilter {
        const filter: StamhoofdFilter = [];

        const periods = this.getActivePeriods(organization ?? null).map((p) => {
            return {
                $: '$rel',
                value: p.id,
                name: p.name,
            };
        });
        const periodIdFilter = periods.length === 1 ? { periodId: periods[0] } : { periodId: { $in: periods } };

        if (this.settings.minAge !== null) {
            filter.push({
                age: {
                    $gt: this.settings.minAge - 1,
                },
            });
        }

        if (this.settings.maxAge !== null) {
            filter.push({
                age: {
                    $lt: this.settings.maxAge + 1,
                },
            });
        }

        if (this.settings.genderType === GroupGenderType.OnlyMale) {
            filter.push({
                gender: Gender.Male,
            });
        }

        if (this.settings.genderType === GroupGenderType.OnlyFemale) {
            filter.push({
                gender: Gender.Male,
            });
        }

        if (this.settings.requireGroupIds.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        groupId: {
                            $in: this.settings.requireGroupIds,
                        },
                    },
                },
            });
        }

        if (this.settings.preventGroupIds.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        groupId: {
                            $not: {
                                $in: this.settings.preventGroupIds,
                            },

                        },
                    },
                },
            });
        }

        if (this.settings.requireDefaultAgeGroupIds.length) {
            filter.push({
                registrations: {
                    $elemMatch: {
                        $and: [
                            periodIdFilter,
                            {
                                group: {
                                    defaultAgeGroupId: {
                                        $in: this.settings.requireDefaultAgeGroupIds,
                                    },
                                },
                            },
                        ],
                    },
                },
            });
        } else {
            if (this.settings.requirePlatformMembershipOn !== null) {
                const requirePlatformMembershipOn = this.settings.requirePlatformMembershipOn;

                filter.push({
                    $or: [
                        {
                            platformMemberships: {
                                $elemMatch: {
                                    startDate: {
                                        $lte: requirePlatformMembershipOn,
                                    },
                                    endDate: {
                                        $gt: requirePlatformMembershipOn,
                                    },
                                },
                            },
                        }, {
                            platformMemberships: {
                                $elemMatch: {
                                    startDate: {
                                        $lte: { $: '$now' },
                                    },
                                    endDate: {
                                        $gt: { $: '$now' },
                                    },
                                },
                            },
                        },
                    ],
                });
            } else if (this.settings.requirePlatformMembershipOnRegistrationDate) {
                filter.push({
                    platformMemberships: {
                        $elemMatch: {
                            startDate: {
                                $lte: { $: '$now' },
                            },
                            endDate: {
                                $gt: { $: '$now' },
                            },
                        },
                    },
                });
            }
        }

        if (STAMHOOFD.userMode === 'platform') {
            if (organization && (!this.settings.requireOrganizationIds.length || this.settings.requireOrganizationIds.includes(organization.id))) {
                filter.push({
                    registrations: {
                        $elemMatch: {
                            $and: [
                                periodIdFilter,
                                {
                                    organizationId: organization.id,
                                },
                            ],
                        },
                    },
                });
            } else if (this.settings.requireOrganizationIds.length) {
                filter.push({
                    registrations: {
                        $elemMatch: {
                            $and: [
                                periodIdFilter,
                                {
                                    organizationId: {
                                        $in: this.settings.requireOrganizationIds,
                                    },
                                },
                            ],
                        },
                    },
                });
            }

            if (this.settings.requireOrganizationTags.length) {
                filter.push({
                    registrations: {
                        $elemMatch: {
                            $and: [
                                periodIdFilter,
                                {
                                    organization: {
                                        tags: {
                                            $in: this.settings.requireOrganizationTags,
                                        },
                                    },
                                },
                            ],
                        },
                    },
                });
            }
        } else {
            filter.push({
                registrations: {
                    $elemMatch: { $and: [periodIdFilter] },
                },
            });
        }

        return filter;
    }

    getTags(options: { app: AppType; now?: Date; organization: Organization | null; blockCreatingNewMembers?: boolean }): GroupTagItem[] {
        const tags: GroupTagItem[] = [];
        const now = options.now ?? new Date();
        const remainingStock = this.settings.getRemainingStockIncludingPricesAndOptions(this);
        const activePreRegistrationDate = this.activePreRegistrationDate;
        const preRegistrations = activePreRegistrationDate !== null;
        const allWaitingList = this.settings.waitingListType === WaitingListType.All;

        if (activePreRegistrationDate !== null && (remainingStock === null || remainingStock > 0) && activePreRegistrationDate > now) {
            tags.push({
                icon: 'calendar',
                title: $t('%1Y7', { date: Formatter.startDate(activePreRegistrationDate) }),
                style: 'warn',
            });
        } else if (preRegistrations && (remainingStock === null || remainingStock > 0)) {
            tags.push({
                icon: 'calendar',
                title: $t('%1bt', { date: Formatter.endDate(this.settings.registrationStartDate ?? new Date()) }),
                style: 'warn',
            });
        }
        if (this.notYetOpen) {
            tags.push({
                icon: 'calendar',
                title: $t('%1Z9', { date: Formatter.startDate(this.settings.registrationStartDate ?? new Date()) }),
                style: 'warn',
            });
        }

        if (options.app === 'dashboard') {
            if (this.status === GroupStatus.Closed) {
                tags.push({
                    icon: 'lock',
                    title: $t('%CZ'),
                    style: 'error',
                });
            } else if (this.settings.registrationEndDate && this.closed && !this.notYetOpen) {
                tags.push({
                    icon: 'lock',
                    title: $t('%1Ve', { date: Formatter.endDate(this.settings.registrationEndDate) }),
                    style: 'error',
                });
            } else if (options.organization && options.organization.id === this.organizationId) {
                if (this.periodId !== options.organization.period.period.id) {
                    tags.push({
                        icon: 'lock',
                        title: $t('%ZZw'),
                        style: 'error',
                    });
                } else if (this.settings.period?.locked) {
                    tags.push({
                        icon: 'lock',
                        title: $t('%ZZu'),
                        style: 'error',
                    });
                }
            }
        }

        if ((!this.closed || (this.status !== GroupStatus.Closed && options.app === 'dashboard')) && this.settings.registrationEndDate && (options.app === 'dashboard' || this.settings.registrationEndDate < new Date(now.getTime() + 1_000 * 60 * 60 * 24 * 31))) {
            tags.push({
                icon: 'lock',
                title: $t('%1d3', { date: Formatter.endDate(this.settings.registrationEndDate) }),
                style: 'warn',
            });
        }

        if (tags.length === 0 && !this.closed && options.app === 'dashboard') {
            tags.push({
                icon: 'earth',
                title: $t('%1EN'),
                style: 'success',
            });
        }
        if (!this.closed && options.app === 'dashboard' && this.type === GroupType.Membership && options.blockCreatingNewMembers) {
            tags.push({
                icon: 'disabled',
                title: $t('%ZdL'),
                style: 'warn',
            });
        }

        if ((!this.closed || this.notYetOpen) && (remainingStock !== null && (remainingStock < 50 || options.app === 'dashboard'))) {
            if (remainingStock > 0) {
                tags.push({
                    icon: 'user',
                    title: remainingStock !== 1 ? $t('%1d9', { count: remainingStock }) : $t('Nog één plaats'),
                    style: 'warn',
                });
            } else if (this.waitingList !== null && !this.waitingList.closed) {
                tags.push({
                    icon: 'clock',
                    title: $t('%1W2'),
                    style: 'error',
                });
            } else {
                tags.push({
                    icon: 'disabled',
                    title: $t('%Um'),
                    style: 'error',
                });
            }
        } else if ((allWaitingList || this.closed) && this.waitingList !== null && !this.waitingList.closed) {
            tags.push({
                icon: 'clock',
                title: $t('%1ZU'),
                style: 'error',
            });
        }

        return tags;
    }

    static decodeField(...args: Parameters<typeof AutoEncoder.decode>) {
        const result = super.decodeField.call(this, ...args) as any as Group;

        // Create circular reference for permission checking in the frontend
        if (result.waitingList && result.type === GroupType.EventRegistration) {
            result.waitingList.parentGroup = result;
        }

        return result as any;
    }
}
