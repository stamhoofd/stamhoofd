import { Gender, AppType, AuditLogType, BalanceItemStatus, BalanceItemType, CheckoutMethodType, CheckoutMethodTypeHelper, DocumentStatus, DocumentStatusHelper, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, FilterWrapperMarker, getAuditLogTypeName, getBalanceItemStatusName, getBalanceItemTypeName, Group, LoadedPermissions, OrderStatus, OrderStatusHelper, Organization, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, Platform, PrivateWebshop, RecordCategory, RecordType, Webshop, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { DateFilterBuilder } from './DateUIFilter';
import { GroupUIFilterBuilder } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from './NumberUIFilter';
import { SimpleNumberFilterBuilder } from './SimpleNumberUIFilter';
import { StringFilterBuilder } from './StringUIFilter';
import { UIFilter, UIFilterBuilder, UIFilterBuilders } from './UIFilter';

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

    const typeFilter = new MultipleChoiceFilterBuilder({
        name: $t(`%1B`),
        options: [
            ...Object.values(AuditLogType).map(type => new MultipleChoiceUIFilterOption(getAuditLogTypeName(type), type)),
        ],
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

//
// CHECKOUT
//
function getCartFilterBuilder(webshop: Webshop) {
    return new GroupUIFilterBuilder({
        name: $t(`%1DQ`),
        description: $t('%17R'),
        builders: [
            new NumberFilterBuilder({
                name: $t(`%17T`),
                type: NumberFilterFormat.Number,
                key: 'amount',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`%Sc`),
                options: webshop.products.map((product) => {
                    return new MultipleChoiceUIFilterOption(product.name, product.id);
                }),
                wrapper: {
                    product: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            }),
            ...webshop.products.filter(product => product.prices.length > 1).map(product => new MultipleChoiceFilterBuilder({
                name: product.name + ' (' + $t('%17S') + ')',
                options: product.prices.map((price) => {
                    return new MultipleChoiceUIFilterOption(price.name, price.id);
                }),
                wrapper: {
                    product: {
                        id: product.id,
                    },
                    productPrice: {
                        id: {
                            $in: FilterWrapperMarker,
                        },
                    },
                },
            })),
        ],
        wrapper: {
            items: {
                $elemMatch: FilterWrapperMarker,
            },
        },
    });
}
export function useCheckoutInMemoryFilterBuilders() {
    return (webshop: Webshop) => {
        const all: UIFilterBuilders = [
            getCartFilterBuilder(webshop),
        ];

        if (webshop.meta.checkoutMethods.length > 1) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t(`%1Mf`),
                    options: webshop.meta.checkoutMethods.map((method) => {
                        return new MultipleChoiceUIFilterOption(method.typeName + ': ' + method.name, method.id);
                    }),
                    wrapper: {
                        checkoutMethod: {
                            id: {
                                $in: FilterWrapperMarker,
                            },
                        },
                    },
                }),
            );
        }

        // Also include complex filters
        all.push(...getFilterBuildersForRecordCategories(webshop.meta.recordCategories));

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };
}

export function getWebshopOrderUIFilterBuilders(preview: PrivateWebshop | WebshopPreview) {
    const builders: UIFilterBuilders = [
        new NumberFilterBuilder({
            name: '#',
            key: 'number',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`%1A`),
            options: Object.values(OrderStatus)
                .filter(s => s !== OrderStatus.Deleted)
                .map((status) => {
                    return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(OrderStatusHelper.getName(status)), status);
                }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
        }),
        new StringFilterBuilder({
            name: $t(`%Gq`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`%1FK`),
            key: 'email',
        }),
    ];

    if (preview.meta.phoneEnabled) {
        builders.push(new StringFilterBuilder({
            name: $t(`%wD`),
            key: 'phone',
        }));
    }

    builders.push(new MultipleChoiceFilterBuilder({
        name: $t(`%M7`),
        options: Object.values(PaymentMethod).map((paymentMethod) => {
            return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(paymentMethod), paymentMethod);
        }),
        wrapper: {
            paymentMethod: {
                $in: FilterWrapperMarker,
            },
        },
    }));

    builders.push(new DateFilterBuilder({
        key: 'paidAt',
        name: $t('%1Jb'),
    }));

    if (preview.meta.checkoutMethods.length > 1) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t(`%1Mf`),
            options: preview.meta.checkoutMethods.map((checkoutMethod) => {
                const name = Formatter.capitalizeFirstLetter(`${CheckoutMethodTypeHelper.getName(checkoutMethod.type)}: ${checkoutMethod.name}`);
                return new MultipleChoiceUIFilterOption(name, checkoutMethod.id);
            }),
            wrapper: {
                checkoutMethodId: { $in: FilterWrapperMarker },
            },
        }));
    }

    builders.push(
        new DateFilterBuilder({
            name: $t(`%cB`),
            key: 'validAt',
        }),
        new NumberFilterBuilder({
            name: $t(`%1JL`),
            key: 'totalPrice',
            type: NumberFilterFormat.Currency,
        }),
        new NumberFilterBuilder({
            name: $t(`%M4`),
            key: 'amount',
        }),
    );

    const timeCount = Formatter.uniqueArray(preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.timeRangeString())).length;
    const dateCount = Formatter.uniqueArray(preview.meta.checkoutMethods.flatMap(method => method.timeSlots.timeSlots).map(t => t.dateString())).length;

    const hasDelivery = preview.meta.checkoutMethods.some(method => method.type === CheckoutMethodType.Delivery);

    // Count checkoutmethods that are not delivery
    const nonDeliveryCount = preview.meta.checkoutMethods.filter(method => method.type !== CheckoutMethodType.Delivery).length;

    if (dateCount > 1) {
        builders.push(
            new DateFilterBuilder({
                name: (hasDelivery && nonDeliveryCount > 0) ? $t(`%cC`) : (hasDelivery ? $t(`%cD`) : $t(`%cE`)),
                key: 'timeSlotDate',
            }));
    }

    if (timeCount > 1) {
        // todo: change sort of timeSlotTime => should take start time into account => composite key or generated index maybe?
        // todo: maybe group
        builders.push(
            new NumberFilterBuilder({
                name: $t(`%cF`),
                key: 'timeSlotEndTime',
                type: NumberFilterFormat.TimeMinutes,
            }));

        builders.push(
            new NumberFilterBuilder({
                name: $t(`%cG`),
                key: 'timeSlotStartTime',
                type: NumberFilterFormat.TimeMinutes,
            }));
    }

    builders.push(new StringFilterBuilder({
        key: 'code',
        name: $t('%1MX'),
        wrapper: {
            discountCodes: {
                $elemMatch: FilterWrapperMarker,
            },
        },
    }));

    if (preview.hasTickets) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t('%1MY'),
            options: preview.hasSingleTickets
                ? [
                        new MultipleChoiceUIFilterOption($t('%1MZ'), 'none'),
                        new MultipleChoiceUIFilterOption($t('%V1'), 'all'),

                    ]
                : [
                        new MultipleChoiceUIFilterOption($t('%1Ma'), 'none'),
                        new MultipleChoiceUIFilterOption($t('%1Mb'), 'partial'),
                        new MultipleChoiceUIFilterOption($t('%1Mc'), 'all'),
                    ],
            wrapper: {
                ticketScanStatus: {
                    $in: FilterWrapperMarker,
                },
            },
        }));

        builders.push(new DateFilterBuilder({
            key: 'ticketScannedAt',
            name: $t('%1Md'),
        }));

        if (!preview.hasSingleTickets) {
            builders.push(new NumberFilterBuilder({
                name: $t('%1Me'),
                key: 'ticketCount',

            }));
        }
    }

    if (preview instanceof Webshop) {
        builders.push(getCartFilterBuilder(preview));
    }

    // Also include complex filters
    builders.push(...getFilterBuildersForRecordCategories(preview.meta.recordCategories));

    const groupFilter = new GroupUIFilterBuilder({ builders });

    return [groupFilter, ...builders];
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

export function getFilterBuildersForRecordCategories(categories: RecordCategory[], prefix = '', options?: { includeNullable?: boolean }) {
    const all: UIFilterBuilder<UIFilter>[] = [];

    for (const category of categories) {
        const allForCategory: UIFilterBuilder<UIFilter>[] = [];
        const categoryPrefix = category.name + ' → ';

        for (const record of category.records) {
            if (record.type === RecordType.Text || record.type === RecordType.Textarea) {
                allForCategory.push(
                    new StringFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        key: 'value',
                        wrapper: {
                            recordAnswers: {
                                [record.id]: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.Integer || record.type === RecordType.Price) {
                allForCategory.push(
                    new NumberFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        key: 'value',
                        type: record.type === RecordType.Price ? NumberFilterFormat.Currency : NumberFilterFormat.Number,
                        wrapper: {
                            recordAnswers: {
                                [record.id]: FilterWrapperMarker,
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.Checkbox) {
                const extra = options?.includeNullable
                    ? [new MultipleChoiceUIFilterOption($t('%1CJ'), null)]
                    : [];
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            new MultipleChoiceUIFilterOption($t('%BM'), true),
                            new MultipleChoiceUIFilterOption($t('%BN'), false),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selected: { $in: FilterWrapperMarker },
                                },
                            },
                        },
                    }),
                );
            }

            if (record.type === RecordType.ChooseOne) {
                const extra = options?.includeNullable
                    ? [new MultipleChoiceUIFilterOption($t('%1CJ'), null)]
                    : [];

                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            ...record.choices.map(c => new MultipleChoiceUIFilterOption(c.name.toString(), c.id)),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selectedChoice: {
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

            if (record.type === RecordType.MultipleChoice) {
                const extra = options?.includeNullable
                    ? [new MultipleChoiceUIFilterOption($t('%1CJ'), null)]
                    : [];

                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            ...record.choices.map(c => new MultipleChoiceUIFilterOption(c.name.toString(), c.id)),
                        ],
                        wrapper: {
                            recordAnswers: {
                                [record.id]: {
                                    selectedChoices: {
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
        }

        allForCategory.push(
            ...getFilterBuildersForRecordCategories(category.childCategories, prefix + categoryPrefix, options),
        );

        if (allForCategory.length > 0) {
            const group = new GroupUIFilterBuilder({
                name: category.name.toString(),
                builders: allForCategory,
            });
            allForCategory.unshift(group);
            all.push(
                group,
            );
        }
    }

    return all;
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
