import { AppType, AuditLogType, BalanceItemStatus, BalanceItemType, CheckoutMethodType, CheckoutMethodTypeHelper, DocumentStatus, DocumentStatusHelper, EventNotificationStatus, EventNotificationStatusHelper, EventNotificationType, FilterWrapperMarker, getAuditLogTypeName, getBalanceItemStatusName, getBalanceItemTypeName, Group, LoadedPermissions, OrderStatus, OrderStatusHelper, Organization, PaymentMethod, PaymentMethodHelper, PaymentStatus, PaymentStatusHelper, PaymentType, PaymentTypeHelper, Platform, PrivateWebshop, RecordCategory, RecordType, Webshop, WebshopPreview } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { computed } from 'vue';
import { Gender } from '../../../../../shared/structures/esm/dist/src/members/Gender';
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
            name: $t(`3bd3f5e8-e8d6-4854-986d-f2ef87285441`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            key: 'email',
        }),
        new GroupUIFilterBuilder({
            name: $t(`92b9161f-cf1d-49a0-b5d1-aab82df4a160`),
            builders: [
                new StringFilterBuilder({
                    name: $t(`67928a02-b3f1-465a-9dd7-569d061599a9`),
                    key: 'name',
                }),
                new StringFilterBuilder({
                    name: $t(`263b7054-d38f-4bb9-be63-84b4e614613d`),
                    key: 'VATNumber',
                }),
                new StringFilterBuilder({
                    name: $t(`12f64ea7-fb54-4178-8267-9de12bdf70d7`),
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
            name: $t('233fbbc9-0118-41fb-9804-631fe55ddf31'),
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
            name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
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
            name: $t(`23671282-34da-4da9-8afd-503811621055`),
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
            name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
            type: NumberFilterFormat.Currency,
            key: 'price',
        }),

        new DateFilterBuilder({
            name: $t(`067200f1-7cc9-4111-b851-47e3e59fe777`),
            key: 'paidAt',
        }),

        new DateFilterBuilder({
            name: $t(`6711ac76-e8c7-482b-b6b4-635ba3d16f60`),
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
            name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
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
            name: $t(`23671282-34da-4da9-8afd-503811621055`),
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
            name: $t(`1205deb9-498d-435d-a6e1-91ea98371523`),
            type: NumberFilterFormat.Currency,
            key: 'priceWithVAT',
        }),

        new NumberFilterBuilder({
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
            type: NumberFilterFormat.Currency,
            key: 'priceOpen',
        }),

        new DateFilterBuilder({
            name: $t(`6711ac76-e8c7-482b-b6b4-635ba3d16f60`),
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
                name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
                key: 'age',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new DateFilterBuilder({
                name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
                key: 'birthDay',
                wrapper: {
                    member: FilterWrapperMarker,
                },
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`9e080d96-2c2b-47e3-b56c-d58d993974c9`),
                options: [
                    new MultipleChoiceUIFilterOption($t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`), Gender.Female),
                    new MultipleChoiceUIFilterOption($t(`b54b9706-4c0c-46a6-9027-37052eb76b28`), Gender.Male),
                    new MultipleChoiceUIFilterOption($t(`26677608-996f-41a5-8a53-543d6efa7de4`), Gender.Other),
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
                name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
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
            name: $t(`28c2bc66-231f-44f3-9249-c1981b871a1f`),
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

export function getOrganizationCompanyFilterBuilders() {
    const all: UIFilterBuilder[] = [
        new StringFilterBuilder({
            name: $t(`17edcdd6-4fb2-4882-adec-d3a4f43a1926`),
            key: 'name',
        }),
        new StringFilterBuilder({
            name: $t(`12f64ea7-fb54-4178-8267-9de12bdf70d7`),
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
                name: $t(`10fd24bb-43dd-4174-9a23-db3ac54af9be`),
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
                name: $t(`709a5ff3-8d79-447b-906d-2c3cdabb41cf`),
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
        name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
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
        name: $t(`877284d7-31b4-4857-a963-405b4139adc2`),
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
        name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
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
        name: $t(`1259b59f-6447-4da8-887e-848f05da346f`),
        description: $t('bca39843-792e-4e94-b1e9-a9fcf2908d05'),
        builders: [
            new NumberFilterBuilder({
                name: $t(`f2931d71-6e65-4b80-8c44-ac1cc328c2bd`),
                type: NumberFilterFormat.Number,
                key: 'amount',
            }),
            new MultipleChoiceFilterBuilder({
                name: $t(`54e32267-042e-4cfc-a423-63977769a98d`),
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
                    name: $t(`b321887c-5a37-4485-846d-5ba0da0f63d4`),
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
            name: $t(`6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8`),
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
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            key: 'email',
        }),
    ];

    if (preview.meta.phoneEnabled) {
        builders.push(new StringFilterBuilder({
            name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
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

    builders.push(new DateFilterBuilder({
        key: 'paidAt',
        name: $t('067200f1-7cc9-4111-b851-47e3e59fe777'),
    }));

    if (preview.meta.checkoutMethods.length > 1) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t(`b321887c-5a37-4485-846d-5ba0da0f63d4`),
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
            name: $t(`5dd11b77-abf6-4449-ac3f-74ac1edb5d65`),
            key: 'validAt',
        }),
        new NumberFilterBuilder({
            name: $t(`43ca079c-2af8-4bde-9f68-abeca3c3a7d0`),
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

    builders.push(new StringFilterBuilder({
        key: 'code',
        name: $t('3697babf-4463-460f-95ee-683a40e5d46d'),
        wrapper: {
            discountCodes: {
                $elemMatch: FilterWrapperMarker,
            },
        },
    }));

    if (preview.hasTickets) {
        builders.push(new MultipleChoiceFilterBuilder({
            name: $t('25d4d39a-c601-4210-a1e4-4f4ab7752561'),
            options: preview.hasSingleTickets
                ? [
                        new MultipleChoiceUIFilterOption($t('aa934a39-f0dd-4e8b-9db8-a7686684a411'), 'none'),
                        new MultipleChoiceUIFilterOption($t('044f91f3-91b5-4109-ad8d-3fea6c0c92e2'), 'all'),

                    ]
                : [
                        new MultipleChoiceUIFilterOption($t('e5908ba1-b344-4dda-a703-667e4f8f8388'), 'none'),
                        new MultipleChoiceUIFilterOption($t('65e51ac7-d5a0-4097-8238-0c9a002e706c'), 'partial'),
                        new MultipleChoiceUIFilterOption($t('ad2e2f13-3139-4489-846f-9740e65fffab'), 'all'),
                    ],
            wrapper: {
                ticketScanStatus: {
                    $in: FilterWrapperMarker,
                },
            },
        }));

        builders.push(new DateFilterBuilder({
            key: 'ticketScannedAt',
            name: $t('03764a56-4f6d-42f1-a0d8-7c8fb1aa97ec'),
        }));

        if (!preview.hasSingleTickets) {
            builders.push(new NumberFilterBuilder({
                name: $t('37c94201-23ff-41f2-b5a6-6b4826581cfa'),
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
            name: $t(`bb5c03d2-d684-40b6-9aa9-6f0877f41441`),
            key: 'id',
        }),
        new NumberFilterBuilder({
            name: $t(`89eafa94-6447-4608-a71e-84752eab10c8`),
            key: 'number',
        }),
        new StringFilterBuilder({
            name: $t(`11d6f2fc-c72d-4c18-aa6d-b8118c2aaa5c`),
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
                        key: 'numberValue',
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
                name: $t('300d2935-b578-48cc-b58e-1c0446a68d59'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('3c90169c-9776-4d40-bda0-dba27a5bad69'),
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
                name: $t('6b4b9fb3-ca24-43cd-9f7b-a5f597b943d8'),
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
                name: $t('0be39baa-0b8e-47a5-bd53-0feeb14a0f93'),
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
                name: $t('3eefa3b1-525b-464b-adef-e3b9efd9257f'),
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
                name: $t('300d2935-b578-48cc-b58e-1c0446a68d59'),
                key: 'startDate',
            }),
            new DateFilterBuilder({
                name: $t('3c90169c-9776-4d40-bda0-dba27a5bad69'),
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
                name: $t('17edcdd6-4fb2-4882-adec-d3a4f43a1926'),
                key: 'name',
            }),

            new MultipleChoiceFilterBuilder({
                name: $t('66f5134c-9e11-4d36-88f9-526587491ecb'),
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
