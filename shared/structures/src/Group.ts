import { ArrayDecoder, AutoEncoder, DateDecoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { v4 as uuidv4 } from 'uuid';

import { Event } from './Event.js';
import { StamhoofdFilter } from './filters/StamhoofdFilter.js';
import { getActivePeriodIds } from './getActivePeriods.js';
import { GroupCategory } from './GroupCategory.js';
import { GroupGenderType } from './GroupGenderType.js';
import { GroupPrivateSettings } from './GroupPrivateSettings.js';
import { GroupSettings, WaitingListType } from './GroupSettings.js';
import { GroupType } from './GroupType.js';
import { Gender } from './members/Gender.js';
import { Organization } from './Organization.js';
import { PermissionLevel } from './PermissionLevel.js';
import { PermissionsResourceType } from './PermissionsResourceType.js';
import { StockReservation } from './StockReservation.js';

export enum GroupStatus {
    Open = 'Open',
    Closed = 'Closed',

    /**
     * @deprecated
     */
    Archived = 'Archived',
}

export function getGroupStatusName(status: GroupStatus) {
    switch (status) {
        case GroupStatus.Open:
            return $t(`d265d3d1-ef01-4cec-8485-e95290ba40d5`);
        case GroupStatus.Closed:
            return $t(`ae8d3a27-6a56-4ae8-ada6-c843f01625b0`);
        case GroupStatus.Archived:
            return $t(`14cf0829-fa0a-4797-8deb-54c095f724ef`);
    }
}

export class Group extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: new EnumDecoder(GroupType), version: 286 })
    type: GroupType = GroupType.Membership;

    @field({ decoder: StringDecoder, version: 250 })
    organizationId: string = '';

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

    getMemberCount({ waitingList }: { waitingList?: boolean } = {}) {
        return this.settings.getMemberCount({ waitingList });
    }

    /**
     * Return the pre registration date only if is is active right now
     */
    get activePreRegistrationDate() {
        if (!this.settings.registrationStartDate) {
            // Registration start date is a requirement for pre registrations
            return null;
        }
        if (this.settings.registrationStartDate < new Date() || this.settings.waitingListType !== WaitingListType.PreRegistrations) {
            // Start date is in the past: registrations are open
            return null;
        }
        return this.settings.preRegistrationsDate;
    }

    /**
     * Closed now, but will open in the future
     */
    get notYetOpen() {
        if (!this.settings.registrationStartDate) {
            return false;
        }

        const now = new Date();
        const preRegistrationDate = this.activePreRegistrationDate;

        if (this.settings.registrationStartDate > now && (!preRegistrationDate || preRegistrationDate > now)) {
            // Start date or pre registration date are in the future

            return true;
        }

        return false;
    }

    /**
     * No registrations and waiting list registrations are possible if closed
     */
    get closed() {
        if (this.status !== GroupStatus.Open) {
            return true;
        }

        if (this.notYetOpen) {
            // Start date or pre registration date are in the future
            return true;
        }

        const now = new Date();
        if (this.settings.registrationEndDate && this.settings.registrationEndDate < now) {
            return true;
        }

        return false;
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

    /**
     * Return the period ids that we consider as active for a given
     * group and organization combination.
     */
    getActivePeriodIds(organization: Organization | null) {
        return getActivePeriodIds(this.periodId, organization);
    }

    getRecommendedFilter(organization?: Organization | null): StamhoofdFilter {
        const filter: StamhoofdFilter = [];

        const periodIds = [...this.getActivePeriodIds(organization ?? null)];
        const periodIdFilter = periodIds.length === 1 ? { periodId: periodIds[0] } : { periodId: { $in: periodIds } };

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
        }
        else {
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
            }
            else if (this.settings.requirePlatformMembershipOnRegistrationDate !== null) {
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
        }
        else if (this.settings.requireOrganizationIds.length) {
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

        return filter;
    }

    static decode(...args: Parameters<typeof AutoEncoder.decode>) {
        const result = super.decode.call(this, ...args) as any as Group;

        // Create circular reference for permission checking in the frontend
        if (result.waitingList && result.type === GroupType.EventRegistration) {
            result.waitingList.parentGroup = result;
        }

        return result as any;
    }
}
