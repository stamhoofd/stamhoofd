import type { AppType, EventNotificationType, Group, LoadedPermissions, Organization, Platform } from '@stamhoofd/structures';
import { AuditLogType, BalanceItemStatus, BalanceItemType, DocumentStatus, DocumentStatusHelper, EventNotificationStatus, EventNotificationStatusHelper, FilterWrapperMarker, Gender, getAuditLogTypeName, getBalanceItemStatusName, getBalanceItemTypeName, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { DateFilterBuilder } from './DateUIFilter';
import { GroupUIFilterBuilder } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from './NumberUIFilter';
import { SimpleNumberFilterBuilder } from './SimpleNumberUIFilter';
import { StringFilterBuilder } from './StringUIFilter';
import type { UIFilter, UIFilterBuilder, UIFilterBuilders } from './UIFilter';
import { getFilterBuildersForRecordCategories } from './filter-builders/record-categories';

export const getCustomerUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`%1JZ`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`%1FK`),
            key: 'email',
        }),
        new GroupUIFilterBuilder({
            name: $t(`%1Ja`),
            builders: [
                new StringFilterBuilder({
                    name: $t(`%1JI`),
                    key: 'name',
                }),
                new StringFilterBuilder({
                    name: $t(`%1CK`),
                    key: 'VATNumber',
                }),
                new StringFilterBuilder({
                    name: $t(`%wa`),
                    key: 'companyNumber',
                }),
            ],
            wrapper: {
                company: FilterWrapperMarker,
            },
        }),
    ];

    builders.unshift(
        new GroupUIFilterBuilder({
            name: $t('%Ul'),
            builders,
            wrapper: {
                customer: FilterWrapperMarker,
            },
        }),
    );

    return builders;
};

export const getPaymentsUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new MultipleChoiceFilterBuilder({
            name: $t(`%M7`),
            options: Object.values(PaymentMethod).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                method: {
                    $in: FilterWrapperMarker,
                },
            },
        }),

        new MultipleChoiceFilterBuilder({
            name: $t(`%1A`),
            options: Object.values(PaymentStatus).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentStatusHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),

        new MultipleChoiceFilterBuilder({
            name: $t(`%1LP`),
            options: Object.values(PaymentType).map((method) => {
                return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(PaymentTypeHelper.getName(method)), method);
            }),
            wrapper: {
                type: {
                    $in: FilterWrapperMarker,
                },
            },
        }),

        new NumberFilterBuilder({
            name: $t(`%1IP`),
            type: NumberFilterFormat.Currency,
            key: 'price',
        }),

        new DateFilterBuilder({
            name: $t(`%1Jb`),
            key: 'paidAt',
        }),

        new DateFilterBuilder({
            name: $t(`%1Jc`),
            key: 'createdAt',
        }),

        getCustomerUIFilterBuilders()[0],
    ];

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
};

export const getBalanceItemsUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new MultipleChoiceFilterBuilder({
            name: $t(`%1A`),
            options: Object.values(BalanceItemStatus).filter(f => f !== BalanceItemStatus.Hidden).map((method) => {
                return new MultipleChoiceUIFilterOption(getBalanceItemStatusName(method), method);
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),

        new MultipleChoiceFilterBuilder({
            name: $t(`%1LP`),
            options: Object.values(BalanceItemType).map((method) => {
                return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(getBalanceItemTypeName(method)), method);
            }),
            wrapper: {
                type: {
                    $in: FilterWrapperMarker,
                },
            },
        }),

        new NumberFilterBuilder({
            name: $t(`%1IP`),
            type: NumberFilterFormat.Currency,
            key: 'priceWithVAT',
        }),

        new NumberFilterBuilder({
            name: $t(`%76`),
            type: NumberFilterFormat.Currency,
            key: 'priceOpen',
        }),

        new DateFilterBuilder({
            name: $t(`%1Jc`),
            key: 'createdAt',
        }),
    ];

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
};

export function useRegisterItemFilterBuilders() {
    return (group: Group) => {
        const all: UIFilterBuilders = [
            new NumberFilterBuilder({
                name: $t(`%9S`),
                key: 'age',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new DateFilterBuilder({
                name: $t(`%17w`),
                key: 'birthDay',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`%1d`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`%XM`), Gender.Female),
                    new MultipleChoiceUIFilterOption($t(`%XK`), Gender.Male),
                    new MultipleChoiceUIFilterOption($t(`%1JG`), Gender.Other),
                ],
                wrapper: {
                    member: {
                        gender: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
        ];

        // Add price filter
        all.push(
            new MultipleChoiceFilterBuilder({
                name: $t(`%62`),
                options: [
                    ...group.settings.prices.map((price) => {
                        return new MultipleChoiceUIFilterOption(price.name.toString(), price.id);
                    }),
                ],
                allowCreation: group.settings.prices.length > 1,
                wrapper: {
                    groupPrice: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
        );

        // Option filter
        for (const menu of group.settings.optionMenus) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: menu.name,
                    options: [
                        ...menu.options.map((option) => {
                            return new MultipleChoiceUIFilterOption(option.name, option.id);
                        }),
                    ],
                    wrapper: {
                        options: {
                            $elemMatch: {
                                optionMenu: {
                                    id: menu.id,
                                },
                                option: {
                                    id: {
                                        $in: FilterWrapperMarker,
                                    },
                                },
                            },
                        },
                    },
                }),
            );
        }

        // Add record categories
        all.push(...getFilterBuildersForRecordCategories(group.settings.recordCategories));

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

// Cached outstanding balances

export const getCachedOutstandingBalanceUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new NumberFilterBuilder({
            name: $t(`%76`),
            type: NumberFilterFormat.Currency,
            key: 'amountOpen',
        }),
        new NumberFilterBuilder({
            name: $t(`%c4`),
            type: NumberFilterFormat.Currency,
            key: 'amountPending',
        }),
    /* new MultipleChoiceFilterBuilder({
        name: 'Type',
        options: [
            new MultipleChoiceUIFilterOption('Verenigingen', ReceivableBalanceType.organization),
            new MultipleChoiceUIFilterOption('Leden', ReceivableBalanceType.member),
            new MultipleChoiceUIFilterOption('Accounts', ReceivableBalanceType.user),
        ],
        wrapper: {
            objectType: {
                $in: FilterWrapperMarker,
            },
        },
    }), */
    ];

    builders.unshift(
        new GroupUIFilterBuilder({
            builders,
        }),
    );

    return builders;
};

//
// ORGANIZATIONS
//

export function getOrganizationCompanyFilterBuilders() {
    const all: UIFilterBuilder[] = [
        new StringFilterBuilder({
            name: $t(`%Gq`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`%wa`),
            key: 'companyNumber',
        }),
        new StringFilterBuilder({
            name: $t(`%1CK`),
            key: 'VATNumber',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t('%1CG'),
            options: [
                new MultipleChoiceUIFilterOption($t('%1CH'), null),
            ],
            wrapper: {
                companyNumber: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
    ];

    // Recursive: self referencing groups
    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

export function useEmailFilterBuilders() {
    return () => {
        const all: UIFilterBuilder[] = [
            new DateFilterBuilder({
                name: $t(`%1D9`),
                key: 'sentAt',
            }),

        ];

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

export function useAdminEmailFilterBuilders() {
    const organization = useOrganization();
    const platform = usePlatform();

    return () => {
        const all: UIFilterBuilder[] = [
            new DateFilterBuilder({
                name: $t(`%1JJ`),
                key: 'createdAt',
            }),
            new DateFilterBuilder({
                name: $t(`%1D9`),
                key: 'sentAt',
            }),
            new NumberFilterBuilder({
                name: $t('%1G2'),
                key: 'emailRecipientsCount',
            }),
            new NumberFilterBuilder({
                name: $t('%1G3'),
                key: 'failedCount',
            }),
            new NumberFilterBuilder({
                name: $t('%1G4'),
                key: 'softFailedCount',
            }),
            new NumberFilterBuilder({
                name: $t('%1G5'),
                key: 'hardBouncesCount',
            }),
            new NumberFilterBuilder({
                name: $t('%1G6'),
                key: 'softBouncesCount',
            }),
            new NumberFilterBuilder({
                name: $t('%1G7'),
                key: 'spamComplaintsCount',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`%1GA`),
                options: [
                    ...(organization.value ? (organization.value.privateMeta?.emails ?? []) : (platform.value.privateConfig?.emails ?? [])).map(e => new MultipleChoiceUIFilterOption(e.name || e.email, e.id)),
                ],
                wrapper: {
                    senderId: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),
            new StringFilterBuilder({
                name: $t(`%aO`),
                key: 'subject',
            }),
            new StringFilterBuilder({
                name: $t(`%1GB`),
                key: 'text',
            }),

        ];

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

export function getOrganizationUIFilterBuildersForTags(platform: Platform) {
    const all: UIFilterBuilder[] = [];

    const tagFilter = new MultipleChoiceFilterBuilder({
        name: $t('%2C'),
        multipleChoiceConfiguration: {
            isSubjectPlural: true,
        },
        options: platform.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
        wrapper: {
            tags: {
                $in: FilterWrapperMarker,
            },
        },
    });

    all.push(tagFilter);

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

// Events
export function useEventUIFilterBuilders({ platform, organizations, app }: { platform: Platform; organizations: Organization[]; app: AppType | 'auto' }) {
    const context = useContext();

    return computed(() => getEventUIFilterBuilders({ platform, organizations, app, permissions: context.value.auth.permissions }));
}

function getEventUIFilterBuilders({ platform, organizations, app, permissions }: { platform: Platform; organizations: Organization[]; app: AppType | 'auto'; permissions: LoadedPermissions | null | undefined }) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    const organizationFilter = new MultipleChoiceFilterBuilder({
        name: $t(`%c7`),
        options: [
            new MultipleChoiceUIFilterOption($t(`%c8`), null),
            ...organizations.map(org => new MultipleChoiceUIFilterOption(org.name, org.id)),
        ],
        wrapper: {
            organizationId: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(organizationFilter);

    const tagsFilter = new MultipleChoiceFilterBuilder({
        name: $t(`%ae`),
        options: [
            new MultipleChoiceUIFilterOption($t(`%c9`), null),
            ...platform.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
        ],
        wrapper: {
            organizationTagIds: {
                $in: FilterWrapperMarker,
            },
        },
    });

    all.push(tagsFilter);

    const allTags = organizations.flatMap(organization => organization.meta.tags);

    const defaultAgeGroupFilter = new MultipleChoiceFilterBuilder({
        name: $t(`%wI`),
        options: [
            new MultipleChoiceUIFilterOption($t(`%cA`), null),
            ...platform.config.defaultAgeGroups.filter(defaultAgeGroup => defaultAgeGroup.isEnabledForTags(allTags)).map(g => new MultipleChoiceUIFilterOption(g.name, g.id)),
        ],
        wrapper: {
            defaultAgeGroupIds: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(defaultAgeGroupFilter);

    const groupFilter = new MultipleChoiceFilterBuilder({
        name: $t(`%1IL`),
        allowCreation: organizations.length > 0,
        options: [
            new MultipleChoiceUIFilterOption($t(`%cA`), null),
            ...organizations
                .flatMap(organization => organization.period.getCategoryTree({ permissions }).getAllGroups().map((g) => {
                    return new MultipleChoiceUIFilterOption((organizations.length > 1 ? (organization.name + ' - ') : '') + g.settings.name, g.id);
                })),
        ],
        wrapper: {
            groupIds: {
                $in: FilterWrapperMarker,
            },
        },
    });
    all.push(groupFilter);

    if (app !== 'registration') {
        const typeFilter = new MultipleChoiceFilterBuilder({
            name: $t(`%1B`),
            options: [
                ...platform.config.eventTypes.map(type => new MultipleChoiceUIFilterOption(type.name, type.id)),
            ],
            wrapper: {
                typeId: {
                    $in: FilterWrapperMarker,
                },
            },
        });

        all.push(typeFilter);
    }

    const ageFilter = new SimpleNumberFilterBuilder({
        name: $t(`%9S`),
        wrapper: {
            $and: [
                {
                    $or: [
                        // null not required, because null always < anything
                        { minAge: { $lte: FilterWrapperMarker } },
                    ],
                },
                {
                    $or: [
                        { maxAge: null },
                        { maxAge: { $gte: FilterWrapperMarker } },
                    ],
                },
            ],
        },
    });

    all.push(ageFilter);

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}

// Events
export function useAuditLogUIFilterBuilders() {
    const all: UIFilterBuilder<UIFilter>[] = [];

    let options: MultipleChoiceUIFilterOption[] = Object.values(AuditLogType).map(type => new MultipleChoiceUIFilterOption(getAuditLogTypeName(type), type));

    if (STAMHOOFD.userMode === 'organization') {
        // remove option for member security code (not available in organization mode)
        options = options.filter(option => option.value !== AuditLogType.MemberSecurityCodeUsed);
    }

    const typeFilter = new MultipleChoiceFilterBuilder({
        name: $t(`%1B`),
        options,
        wrapper: {
            type: {
                $in: FilterWrapperMarker,
            },
        },
    });

    all.push(typeFilter);

    all.unshift(
        new GroupUIFilterBuilder({
            builders: all,
        }),
    );

    return all;
}



export function getDocumentsUIFilterBuilders() {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`%Kq`),
            key: 'id',
        }),
        new NumberFilterBuilder({
            name: $t(`%cH`),
            key: 'number',
        }),
        new StringFilterBuilder({
            name: $t(`%6o`),
            key: 'description',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`%17`),
            options: Object.values(DocumentStatus).map((status) => {
                return new MultipleChoiceUIFilterOption(
                    Formatter.capitalizeFirstLetter(DocumentStatusHelper.getName(status)),
                    status,
                );
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
    ];
    const groupFilter = new GroupUIFilterBuilder({ builders });

    return [groupFilter, ...builders];
}

/**
 * These filters are compatible with the SQLFilter in the backend
 */
export function useEventNotificationBackendFilterBuilders() {
    const platform = usePlatform();

    return () => {
        const all: UIFilterBuilders = [
            new DateFilterBuilder({
                name: $t('%7e'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('%wB'),
                key: 'endDate',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('%Ay'),
                options: [
                    ...platform.value.config.eventTypes.map((eventType) => {
                        return new MultipleChoiceUIFilterOption(eventType.name, eventType.id);
                    }),
                ],
                wrapper: {
                    events: {
                        $elemMatch: {
                            typeId: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('%1A'),
                options: [
                    ...Object.values(EventNotificationStatus).map((status) => {
                        return new MultipleChoiceUIFilterOption(
                            Formatter.capitalizeFirstLetter(EventNotificationStatusHelper.getName(status)),
                            status,
                        );
                    }),
                ],
                wrapper: {
                    status: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('%3G'),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                },
                options: platform.value.config.tags.map(tag => new MultipleChoiceUIFilterOption(tag.name, tag.id)),
                wrapper: {
                    organization: {
                        $elemMatch: {
                            tags: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            }),
            new StringFilterBuilder({
                name: $t('%7C'),
                key: 'uri',
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),

            new StringFilterBuilder({
                name: $t('%CX'),
                key: 'name',
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ];

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

/**
 * These filters are compatible with the SQLFilter in the backend
 */
export function useEventNotificationInMemoryFilterBuilders() {
    const platform = usePlatform();

    return (type: EventNotificationType) => {
        const all: UIFilterBuilders = [
            new DateFilterBuilder({
                name: $t('%7e'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('%wB'),
                key: 'endDate',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('%Ay'),
                options: [
                    ...platform.value.config.eventTypes.map((eventType) => {
                        return new MultipleChoiceUIFilterOption(eventType.name, eventType.id);
                    }),
                ],
                wrapper: {
                    events: {
                        $elemMatch: {
                            typeId: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                },
            }),
        ];

        if (type) {
            // Also include complex filters
            all.push(...getFilterBuildersForRecordCategories(type.recordCategories));
        }

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

/**
 * These filters are compatible with the SQLFilter in the backend
 */
export function useEmailRecipientsFilterBuilders() {
    return () => {
        const all: UIFilterBuilders = [
            new StringFilterBuilder({
                name: $t('%1FK'),
                key: 'email',
            }),

            new StringFilterBuilder({
                name: $t('%Gq'),
                key: 'name',
            }),

            new MultipleChoiceFilterBuilder({
                name: $t('%1JM'),
                options: [
                    new MultipleChoiceUIFilterOption($t('%1G8'), 'failError'),
                    new MultipleChoiceUIFilterOption($t('%1F8'), 'hardBounce'),
                    new MultipleChoiceUIFilterOption($t('%1F9'), 'softBounce'),
                    new MultipleChoiceUIFilterOption($t('%1G9'), 'spam'),
                ],
                wrapFilter: (f) => {
                    const choices = Array.isArray(f) ? f : [f];
                    const conditions: any[] = [];

                    if (choices.includes('failError')) {
                        conditions.push({
                            failError: {
                                $neq: null,
                            },
                        });
                    }

                    if (choices.includes('hardBounce')) {
                        conditions.push({
                            hardBounceError: {
                                $neq: null,
                            },
                        });
                    }

                    if (choices.includes('softBounce')) {
                        conditions.push({
                            softBounceError: {
                                $neq: null,
                            },
                        });
                    }

                    if (choices.includes('spam')) {
                        conditions.push({
                            spamComplaintError: {
                                $neq: null,
                            },
                        });
                    }

                    if (conditions.length === 0) {
                        return {};
                    }
                    if (conditions.length === 1) {
                        return conditions[0];
                    }

                    return {
                        $or: conditions,
                    };
                },
                unwrapFilter: (f) => {
                    if (typeof f !== 'object') return null;

                    const results: string[] = [];
                    const orConditions = (f as any).$or ? (f as any).$or : [f];

                    for (const condition of orConditions) {
                        if (condition.failError?.$neq === null) {
                            results.push('failError');
                        }
                        else if (condition.hardBounceError?.$neq === null) {
                            results.push('hardBounce');
                        }
                        else if (condition.softBounceError?.$neq === null) {
                            results.push('softBounce');
                        }
                        else if (condition.spamComplaintError?.$neq === null) {
                            results.push('spam');
                        }
                        else {
                            return null;
                        }
                    }

                    if (results.length) {
                        return results;
                    }

                    return null;
                },
            }),

        ];

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}
