import { AppType, AuditLogType, CheckoutMethodType, CheckoutMethodTypeHelper, DocumentStatus, DocumentStatusHelper, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, FilterWrapperMarker, getAuditLogTypeName, Group, LoadedPermissions, OrderStatus, OrderStatusHelper, Organization, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, Platform, PrivateWebshop, RecordCategory, RecordType, SetupStepType, StamhoofdFilter, User, Webshop, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { Gender } from '../../../../../shared/structures/esm/dist/src/members/Gender';
import { useContext, useOrganization, usePlatform } from '../hooks';
import { DateFilterBuilder } from './DateUIFilter';
import { GroupUIFilterBuilder } from './GroupUIFilter';
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterMode, MultipleChoiceUIFilterOption } from './MultipleChoiceUIFilter';
import { NumberFilterBuilder, NumberFilterFormat } from './NumberUIFilter';
import { SimpleNumberFilterBuilder } from './SimpleNumberUIFilter';
import { StringFilterBuilder } from './StringUIFilter';
import { UIFilter, UIFilterBuilder, UIFilterBuilders } from './UIFilter';

export const getPaymentsUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new MultipleChoiceFilterBuilder({
            name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
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
            name: $t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`),
            options: Object.values(PaymentStatus).map((method) => {
                return new MultipleChoiceUIFilterOption(PaymentStatusHelper.getNameCapitalized(method), method);
            }),
            wrapper: {
                status: {
                    $in: FilterWrapperMarker,
                },
            },
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
                name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
                key: 'age',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new DateFilterBuilder({
                name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
                key: 'birthDay',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`fd3fea4f-73c7-4c8d-90cd-80ea90e53b98`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`), Gender.Female),
                    new MultipleChoiceUIFilterOption($t(`b54b9706-4c0c-46a6-9027-37052eb76b28`), Gender.Male),
                    new MultipleChoiceUIFilterOption($t(`8f7475aa-c110-49b2-8017-1a6dd0fe72f9`), Gender.Other),
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
                name: $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`),
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
            name: $t(`40d7ac9f-f62d-4a9d-8b2f-5fcfb938c12f`),
            type: NumberFilterFormat.Currency,
            key: 'amountOpen',
        }),
        new NumberFilterBuilder({
            name: $t(`5e73bf1c-6413-4fa5-8049-bff5faf4d8ea`),
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

const getOrganizationMemberUIFilterBuilders: () => UIFilterBuilders = () => {
    const builders: UIFilterBuilders = [
        new StringFilterBuilder({
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
            key: 'firstName',
        }),
        new StringFilterBuilder({
            name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
            key: 'lastName',
        }),
        new StringFilterBuilder({
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            key: 'email',
        }),
    ];

    return builders;
};

export function getOrganizationCompanyFilterBuilders() {
    const all: UIFilterBuilder[] = [
        new StringFilterBuilder({
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`c10884fe-e858-48f6-875b-a1132c618df3`),
            key: 'companyNumber',
        }),
        new StringFilterBuilder({
            name: $t(`263b7054-d38f-4bb9-be63-84b4e614613d`),
            key: 'VATNumber',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t('58f56570-0bcc-4ec1-a42e-94dbf2677bc2'),
            options: [
                new MultipleChoiceUIFilterOption($t('1c5b447a-93e8-46da-b6e1-ffc29a2967e8'), null),
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
                name: $t(`69b8f1cf-5531-4df5-bca1-0026fa2c8edb`),
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
                name: $t(`52961dd4-be19-47a1-abe6-1e3c34e8157c`),
                key: 'createdAt',
            }),
            new DateFilterBuilder({
                name: $t(`69b8f1cf-5531-4df5-bca1-0026fa2c8edb`),
                key: 'sentAt',
            }),
            new NumberFilterBuilder({
                name: $t('cbc2254d-58c7-4f51-bb2d-dcca1635386f'),
                key: 'emailRecipientsCount',
            }),
            new NumberFilterBuilder({
                name: $t('1c8d06f2-fefa-402f-951a-b89755abbcf9'),
                key: 'failedCount',
            }),
            new NumberFilterBuilder({
                name: $t('e05453f8-3355-4c30-bc6a-a81a3b028ae3'),
                key: 'softFailedCount',
            }),
            new NumberFilterBuilder({
                name: $t('c991fbae-a87b-473c-927d-7b8b78246f8f'),
                key: 'hardBouncesCount',
            }),
            new NumberFilterBuilder({
                name: $t('0239e522-2bcb-42b9-83f9-6b37cb8fb96f'),
                key: 'softBouncesCount',
            }),
            new NumberFilterBuilder({
                name: $t('31b066b6-aca9-4ebf-ab0c-bd7df2127149'),
                key: 'spamComplaintsCount',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`b2ef4163-dad6-471a-90f3-edcaf6a4e1b8`),
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
                name: $t(`f9ce67b8-22b4-4588-a78b-51036839488a`),
                key: 'subject',
            }),
            new StringFilterBuilder({
                name: $t(`cc262942-6716-4860-8dab-ac0a09245480`),
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

export function useGetOrganizationUIFilterBuilders() {
    const platform = usePlatform();

    const setupStepFilterNameMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('be92d7b0-92ad-42d6-b9e2-b414671ac57d'),
        [SetupStepType.Companies]: $t('6313a021-6795-4b7e-842c-f4574e433324'),
        [SetupStepType.Groups]: $t('b6458e9c-2ddf-4cb0-8051-fb6a220c4127'),
        [SetupStepType.Premises]: $t('7f531562-9609-456e-a8c3-2b373cad3f29'),
        [SetupStepType.Emails]: $t('36a44efc-4cb0-4180-8678-938cc51d3ae8'),
        [SetupStepType.Payment]: $t('d951a3d6-58f6-4e56-a482-2b8652ddd3bf'),
        [SetupStepType.Registrations]: $t('98a4f650-2fc9-455f-8454-dfe7a8140faa'),
    };

    const getOrganizationUIFilterBuilders = (user: User | null) => {
        const all = [
            new StringFilterBuilder({
                name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
                key: 'name',
            }),

            new StringFilterBuilder({
                name: $t(`54b992a4-20e1-4232-8d2e-93c9353c6af3`),
                key: 'city',
            }),

            new StringFilterBuilder({
                name: $t(`5ed579c6-bfe4-453b-bc13-5e38690849e1`),
                key: 'postalCode',
            }),

            new StringFilterBuilder({
                name: $t('5e99e2aa-a240-4894-8de3-f8f0fef20068'),
                key: 'uri',
            }),

            new GroupUIFilterBuilder({
                name: $t(`97dc1e85-339a-4153-9413-cca69959d731`),
                description: $t('6bf80a05-84b0-47ba-ad41-66e2a106669b'),
                builders: getOrganizationMemberUIFilterBuilders(),
                wrapper: {
                    members: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`1bb1402a-c26b-4516-bbe1-08aff32ee3e8`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`1bb1402a-c26b-4516-bbe1-08aff32ee3e8`), 1),
                    new MultipleChoiceUIFilterOption($t(`ddfa1e2d-bb72-4781-8754-d5002249f30d`), 0),
                ],
                wrapper: {
                    active: {
                        $in: FilterWrapperMarker,
                    },
                },
            }),

            new MultipleChoiceFilterBuilder({
                name: $t(`95fc75cf-bf23-4895-bb64-dfec3944596c`),
                multipleChoiceConfiguration: {
                    isSubjectPlural: true,
                    mode: MultipleChoiceUIFilterMode.And,
                    showOptionSelectAll: true,
                },
                options: Object.entries(setupStepFilterNameMap).map(
                    ([k, v]) =>
                        new MultipleChoiceUIFilterOption(
                            v,
                            k as SetupStepType,
                        ),
                ),
                wrapFilter: (f: StamhoofdFilter) => {
                    const choices = Array.isArray(f) ? f : [f];

                    return {
                        setupSteps: {
                            $elemMatch: {
                                periodId: {
                                    $eq: platform.value.period.id,
                                },
                                ...Object.fromEntries(
                                    Object.values(SetupStepType)
                                        .filter(
                                            x => choices.includes(x),
                                        )
                                        .map((setupStep) => {
                                            return [
                                                setupStep,
                                                {
                                                    reviewedAt: {
                                                        $neq: null,
                                                    },
                                                    complete: true,
                                                },
                                            ];
                                        }),
                                ),
                            },
                        },
                    };
                },
                unwrapFilter: (f: StamhoofdFilter): StamhoofdFilter | null => {
                    if (typeof f !== 'object') return null;

                    const elemMatch = (f as any).setupSteps?.$elemMatch;
                    if (!elemMatch) return null;

                    const periodId = elemMatch.periodId?.$eq;

                    if (periodId !== platform.value.period.id) return null;

                    const enumValues = Object.values(SetupStepType);
                    const stringifiedValueToMatch = JSON.stringify({
                        reviewedAt: { $neq: null },
                        complete: true,
                    });

                    const results: SetupStepType[] = [];

                    for (const [key, value] of Object.entries(elemMatch)) {
                        if (enumValues.includes(key as SetupStepType)) {
                            if (JSON.stringify(value) === stringifiedValueToMatch) {
                                results.push(key as SetupStepType);
                            }
                            else {
                                return null;
                            }
                        }
                        else if (key !== 'periodId') {
                            return null;
                        }
                    }

                    if (results.length) {
                        return results;
                    }

                    return null;
                },
            }),
            new GroupUIFilterBuilder({
                name: $t(`d6244dd4-a0b6-4063-9f93-91c5ab91905c`),
                description: $t('1ca52417-1476-4cbb-a240-335a18fedf45'),
                builders: getOrganizationCompanyFilterBuilders(),
                wrapper: {
                    companies: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),
        ];

        if (user?.permissions?.platform !== null) {
            all.push(
                new MultipleChoiceFilterBuilder({
                    name: $t('ec2de613-f06f-4d9a-888a-40f98b6b3727'),
                    multipleChoiceConfiguration: {
                        isSubjectPlural: true,
                    },
                    options: platform.value.config.tags.map((tag) => {
                        return new MultipleChoiceUIFilterOption(tag.name, tag.id);
                    }),
                    wrapper: {
                        tags: {
                            $in: FilterWrapperMarker,
                        },
                    },
                }),
            );
        }

        // Recursive: self referencing groups
        all.unshift(
            new GroupUIFilterBuilder({
                builders: all,
            }),
        );

        return all;
    };

    return { getOrganizationUIFilterBuilders };
}

export function getOrganizationUIFilterBuildersForTags(platform: Platform) {
    const all: UIFilterBuilder[] = [];

    const tagFilter = new MultipleChoiceFilterBuilder({
        name: $t('ceba695c-105b-49c9-aaa4-bf716c4aec6b'),
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
        name: $t(`6aedccdb-08e6-42c5-ae54-cb26c181ab02`),
        options: [
            new MultipleChoiceUIFilterOption($t(`208e986f-e479-4846-bf51-e557a5d38994`), null),
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
        name: $t(`2faa00db-5af7-4556-ac49-5b15abf2182f`),
        options: [
            new MultipleChoiceUIFilterOption($t(`3743b6e2-1c6b-4831-a228-6ef082377e3b`), null),
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
        name: $t(`494ad9b9-c644-4b71-bd38-d6845706231f`),
        options: [
            new MultipleChoiceUIFilterOption($t(`fd0de77c-fa11-465b-9a6e-27a766a54efc`), null),
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
        name: $t(`f52db2d7-c0f5-4f9c-b567-62f657787339`),
        allowCreation: organizations.length > 0,
        options: [
            new MultipleChoiceUIFilterOption($t(`fd0de77c-fa11-465b-9a6e-27a766a54efc`), null),
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
            name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
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
        name: $t(`e62afedb-ad86-4827-ae25-3d17e384fe2c`),
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
        name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
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
        name: $t(`ab3e4560-a403-4a20-8dab-c76eb74794cc`),
        description: $t('bca39843-792e-4e94-b1e9-a9fcf2908d05'),
        builders: [
            new NumberFilterBuilder({
                name: $t(`f2931d71-6e65-4b80-8c44-ac1cc328c2bd`),
                type: NumberFilterFormat.Number,
                key: 'amount',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`bc0d5675-c4e8-48d8-ba51-557e7a95690f`),
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
                name: product.name + ' (' + $t('db51d1ac-29aa-46f6-a77e-29a4f66ca74b') + ')',
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
                    name: $t(`d241c647-1fd2-4ce4-8356-3891abca19e9`),
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
            name: $t(`e4b54218-b4ff-4c29-a29e-8bf9a9aef0c5`),
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
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            key: 'email',
        }),
    ];

    if (preview.meta.phoneEnabled) {
        builders.push(new StringFilterBuilder({
            name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
            key: 'phone',
        }));
    }

    builders.push(new MultipleChoiceFilterBuilder({
        name: $t(`07e7025c-0bfb-41be-87bc-1023d297a1a2`),
        options: Object.values(PaymentMethod).map((paymentMethod) => {
            return new MultipleChoiceUIFilterOption(PaymentMethodHelper.getNameCapitalized(paymentMethod), paymentMethod);
        }),
        wrapper: {
            paymentMethod: {
                $in: FilterWrapperMarker,
            },
        },
    }));

    const distinctCheckoutMethods = Formatter.uniqueArray(preview.meta.checkoutMethods.map(m => m.type));

    if (distinctCheckoutMethods.length > 1) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t(`389460d3-8e4b-4238-8d57-a106ec987bcd`),
            options: distinctCheckoutMethods.map((checkoutMethod) => {
                return new MultipleChoiceUIFilterOption(Formatter.capitalizeFirstLetter(CheckoutMethodTypeHelper.getName(checkoutMethod)), checkoutMethod);
            }),
            wrapper: {
                checkoutMethod: {
                    $in: FilterWrapperMarker,
                },
            },
        }));
    }

    builders.push(
        new DateFilterBuilder({
            name: $t(`5dd11b77-abf6-4449-ac3f-74ac1edb5d65`),
            key: 'validAt',
        }),
        new NumberFilterBuilder({
            name: $t(`a023893e-ab2c-4215-9981-76ec16336911`),
            key: 'totalPrice',
            type: NumberFilterFormat.Currency,
        }),
        new NumberFilterBuilder({
            name: $t(`697df3e7-fbbf-421d-81c2-9c904dce4842`),
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
                name: (hasDelivery && nonDeliveryCount > 0) ? $t(`3c712881-ef26-474f-a431-dd1c74011260`) : (hasDelivery ? $t(`1e5d1c96-1c8d-4608-b68d-c5e395874aab`) : $t(`26bf686d-2d75-44d3-8ade-d99e939be9b2`)),
                key: 'timeSlotDate',
            }));
    }

    if (timeCount > 1) {
        // todo: change sort of timeSlotTime => should take start time into account => composite key or generated index maybe?
        // todo: maybe group
        builders.push(
            new NumberFilterBuilder({
                name: $t(`4f4fd620-9852-495b-9899-1c598b49924a`),
                key: 'timeSlotEndTime',
                type: NumberFilterFormat.TimeMinutes,
            }));

        builders.push(
            new NumberFilterBuilder({
                name: $t(`bc92bec8-a315-4f67-8bee-7c210e19b8ef`),
                key: 'timeSlotStartTime',
                type: NumberFilterFormat.TimeMinutes,
            }));
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
            name: $t(`bb5c03d2-d684-40b6-9aa9-6f0877f41441`),
            key: 'id',
        }),
        new NumberFilterBuilder({
            name: $t(`89eafa94-6447-4608-a71e-84752eab10c8`),
            key: 'number',
        }),
        new StringFilterBuilder({
            name: $t(`3e3c4d40-7d30-4f4f-9448-3e6c68b8d40d`),
            key: 'description',
        }),
        new MultipleChoiceFilterBuilder({
            name: $t(`62a07ea0-53ad-4962-88ff-26ea1ab493b0`),
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
                    ? [new MultipleChoiceUIFilterOption($t('e420367f-7ce9-4dd3-95b7-c24d0649cb59'), null)]
                    : [];
                allForCategory.push(
                    new MultipleChoiceFilterBuilder({
                        name: prefix + categoryPrefix + record.name,
                        options: [
                            ...extra,
                            new MultipleChoiceUIFilterOption($t('d87cdb56-c8a6-4466-a6fd-f32fe59561f5'), true),
                            new MultipleChoiceUIFilterOption($t('01b79813-933b-4045-b426-82700f921eaa'), false),
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
                    ? [new MultipleChoiceUIFilterOption($t('e420367f-7ce9-4dd3-95b7-c24d0649cb59'), null)]
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
                    ? [new MultipleChoiceUIFilterOption($t('e420367f-7ce9-4dd3-95b7-c24d0649cb59'), null)]
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
                                        $elemMatch: {
                                            id: {
                                                $in: FilterWrapperMarker,
                                            },
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
                name: $t('86983e38-4283-4f0a-bd1d-f48f050d3681'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('c15040b1-3202-45a8-8d30-030a4e4c5f9c'),
                key: 'endDate',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('b8edf1c5-ebc8-4aae-83c1-249c08db529d'),
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
                name: $t('fde0cfa6-c279-4eef-ab75-8f62fd4028a8'),
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
                name: $t('cef37396-3c75-4a85-b14e-d1f7cfb9e546'),
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
                name: $t('05723781-9357-41b2-9fb8-cb4f80dde7f9'),
                key: 'uri',
                wrapper: {
                    organization: {
                        $elemMatch: FilterWrapperMarker,
                    },
                },
            }),

            new StringFilterBuilder({
                name: $t('47754708-6f27-4afd-b9fe-600a209cb980'),
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
                name: $t('86983e38-4283-4f0a-bd1d-f48f050d3681'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('c15040b1-3202-45a8-8d30-030a4e4c5f9c'),
                key: 'endDate',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t('b8edf1c5-ebc8-4aae-83c1-249c08db529d'),
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
                name: $t('237d0720-13f0-4029-8bf2-4de7e0a9a358'),
                key: 'email',
            }),

            new StringFilterBuilder({
                name: $t('45ebf52f-e5ba-4995-a3d8-e300f5a9e707'),
                key: 'name',
            }),

            new MultipleChoiceFilterBuilder({
                name: $t('c251e956-4c8e-455c-b648-ca26d37beea7'),
                options: [
                    new MultipleChoiceUIFilterOption($t('51302d94-ca1d-4fe6-b7a3-1bf571a306e0'), 'failError'),
                    new MultipleChoiceUIFilterOption($t('b33eff3e-008a-4859-b2c7-dc84ae77a2f8'), 'hardBounce'),
                    new MultipleChoiceUIFilterOption($t('c39fe846-065d-42b2-a34c-02147926d947'), 'softBounce'),
                    new MultipleChoiceUIFilterOption($t('671720b3-bc3d-4f54-b79a-28d24937d52e'), 'spam'),
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
