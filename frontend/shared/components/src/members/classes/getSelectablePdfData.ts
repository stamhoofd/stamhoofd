import { SelectableColumn } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking';
import { AccessRight, FinancialSupportSettings, getGenderName, Group, GroupType, Organization, Parent, ParentTypeHelper, Platform, PlatformMember, RecordCategory, RecordCheckboxAnswer, RecordChooseOneAnswer, RecordMultipleChoiceAnswer, RecordSettings, RecordType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { SelectablePdfData } from '../../export/SelectablePdfData';

function returnNullIfNoAccessRightFactory(auth: ContextPermissions) {
    return <T extends SelectableColumn>(column: T, requiresAccessRights: AccessRight[]): T | null => {
        if (requiresAccessRights.some(accessRight => !auth.hasAccessRight(accessRight))) {
            return null;
        }

        return column;
    };
}

export function getSelectablePdfData({ platform, organization, auth, groupColumns }: { platform: Platform; organization: Organization | null; auth: ContextPermissions; groupColumns?: SelectablePdfData<PlatformMember>[] }) {
    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories,
    ];

    const financialSupportSettings = platform.config.financialSupport ?? FinancialSupportSettings.create({});
    const financialSupportTitle = financialSupportSettings.title;

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    const returnNullIfNoAccessRight = returnNullIfNoAccessRightFactory(auth);

    const columns: SelectablePdfData<PlatformMember>[] = [
        new SelectablePdfData<PlatformMember>({
            id: 'id',
            name: $t(`8daf57de-69cf-48fe-b09b-772c54473184`),
            description: $t(`b697f010-9b5f-4944-8cae-8c8649d2c2f2`),
            enabled: false,
            getValue: member => member.id,
        }),
        // todo: only if platform?
        new SelectablePdfData<PlatformMember>({
            id: 'memberNumber',
            name: $t('123be534-a0be-4a6e-b03f-021659e1d8ba'),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.memberNumber,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'firstName',
            name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.firstName,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'lastName',
            name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.lastName,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'birthDay',
            name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.birthDay,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'age',
            name: $t(`8c1f264f-3b0b-49b9-8a29-9ceb2dfd7754`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.age,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'gender',
            enabled: false,
            name: $t(`08ef39ff-3431-4975-8c46-8fb68c946432`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                getGenderName(object.details.gender),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'phone',
            name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.phone,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'email',
            enabled: false,
            name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.email,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'address',
            name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
            description: $t(`01e99208-dce7-4109-8cf2-3cc74c4df45c`),
            // todo: check if this is correct?
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.address?.toString(),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'securityCode',
            name: $t(`0fa4253f-1cfd-4394-93b4-dfba8da04738`),
            enabled: false,
            description: $t(`aa45000f-8cff-4cb6-99b2-3202eb64c4a8`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.securityCode,
        }),

        returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
            id: 'requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => !!object.details.requiresFinancialSupport?.value,
        }), [AccessRight.MemberReadFinancialData]),
        returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
            id: 'uitpasNumber',
            name: $t(`87c1a48c-fef5-44c3-ae56-c83463fcfb84`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.uitpasNumberDetails?.uitpasNumber,
        }), [AccessRight.MemberReadFinancialData]),

        new SelectablePdfData<PlatformMember>({
            id: 'notes',
            name: $t(`7f3af27c-f057-4ce3-8385-36dfb99745e8`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.notes,
        }),
        returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
            id: 'nationalRegisterNumber',
            enabled: false,
            name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.nationalRegisterNumber?.toString() ?? '',
        }), [AccessRight.MemberManageNRN]),

        ...(groupColumns ?? []),

        ...(!organization
            ? [
                    new SelectablePdfData<PlatformMember>({
                        id: 'organization',
                        name: $t(`a0b1e726-345d-4288-a1db-7437d1b47482`),
                        enabled: false,
                        getValue: (member: PlatformMember) => {
                            const organizations = member.filterOrganizations({
                                currentPeriod: true,
                                types: [GroupType.Membership],
                            });
                            const str
                    = Formatter.joinLast(
                        organizations.map(o => o.name).sort(),
                        ', ',
                        ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                            return str;
                        },
                    }),
                    new SelectablePdfData<PlatformMember>({
                        id: 'uri',
                        name: $t(`05723781-9357-41b2-9fb8-cb4f80dde7f9`),
                        enabled: false,
                        getValue: (member: PlatformMember) => {
                            const organizations = member.filterOrganizations({
                                currentPeriod: true,
                                types: [GroupType.Membership],
                            });
                            const str
                    = Formatter.joinLast(
                        organizations.map(o => o.uri).sort(),
                        ', ',
                        ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                            return str;
                        },
                    }),
                    new SelectablePdfData<PlatformMember>({
                        id: 'defaultAgeGroup',
                        name: $t(`0ef2bbb3-0b3c-411a-8901-a454cff1f839`),
                        enabled: false,
                        getValue: (member: PlatformMember) => {
                            const groups = member.filterRegistrations({
                                currentPeriod: true,
                                types: [GroupType.Membership],
                                // todo: check if this is correct
                                organizationId: undefined,
                            });
                            const defaultAgeGroupIds = Formatter.uniqueArray(
                                groups.filter(o => o.group.defaultAgeGroupId),
                            );
                            const defaultAgeGroups = defaultAgeGroupIds.map(
                                o =>
                                    Platform.shared.config.defaultAgeGroups.find(
                                        g => g.id === o.group.defaultAgeGroupId,
                                    )?.name ?? $t(`6aeee253-beb2-4548-b60e-30836afcf2f0`),
                            );
                            const str
                    = Formatter.joinLast(
                        Formatter.uniqueArray(defaultAgeGroups).sort(),
                        ', ',
                        ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                            return str;
                        },
                    }),
                ]
            : []),

        ...(organization
            ? [
                    new SelectablePdfData<PlatformMember>({
                        id: 'group',
                        name: $t(`0c230001-c3be-4a8e-8eab-23dc3fd96e52`),
                        enabled: false,
                        getValue: (member: PlatformMember) => {
                            const groups = member.filterRegistrations({
                                currentPeriod: true,
                                types: [GroupType.Membership],
                                // todo: check if this is correct
                                organizationId: organization.id,
                            });
                            const str
                    = Formatter.joinLast(
                        Formatter.uniqueArray(
                            groups.map(o => o.group.settings.name.toString()),
                        ).sort(),
                        ', ',
                        ' ' + $t(`6a156458-b396-4d0f-b562-adb3e38fc51b`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                            return str;
                        },
                    }),
                ]
            : []),

        ...[1, 2].flatMap((parentNumber, parentIndex) => {
            const getId = (value: string) => `parent.${parentIndex}.${value}`;
            const category = `Ouder ${parentNumber}`;
            const enabled = false;
            const getParent = (member: PlatformMember): Parent | null | undefined => member.patchedMember.details.parents[parentIndex];

            return [
                new SelectablePdfData<PlatformMember>({
                    id: getId('type'),
                    name: $t(`6c9d45e5-c9f6-49c8-9362-177653414c7e`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => {
                        const type = getParent(object)?.type;
                        if (type) {
                            return ParentTypeHelper.getName(type);
                        }

                        return type;
                    },
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('firstName'),
                    name: $t(`603606c2-95ca-4967-814c-53ec3297bf33`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.firstName,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('lastName'),
                    name: $t(`033780e9-417d-4f0a-9aba-7ddfdf655d22`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.lastName,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('phone'),
                    name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.phone,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('email'),
                    name: $t(`237d0720-13f0-4029-8bf2-4de7e0a9a358`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.email,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('address'),
                    name: $t(`0a37de09-120b-4bea-8d13-6d7ed6823884`),
                    category,
                    enabled,
                    // todo: check if this is correct?
                    getValue: (object: PlatformMember) => getParent(object)?.address?.toString(),

                }),
                returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.nationalRegisterNumber?.toString(),
                }), [AccessRight.MemberManageNRN]),
            ];
        }),

        new SelectablePdfData<PlatformMember>({
            id: 'unverifiedPhones',
            name: $t(`62ce5fa4-3ea4-4fa8-a495-ff5eef1ec5d4`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedPhones.join(', '),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'unverifiedEmails',
            name: $t(`1363c0ee-0f4b-43f8-a9ee-a2a6091e5d96`),
            category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedEmails.join(', '),
        }),

        ...[1, 2].map((number, index) => {
            return new SelectablePdfData<PlatformMember>({
                id: `unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`94823cfc-f583-4288-bf44-0a7cfec9e61f`),
                enabled: false,
                getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedAddresses.map(a => a.toString()).join('; '),
            });
        }),

        ...flattenedCategories.flatMap((category) => {
            return category.getAllRecords().flatMap((record) => {
                return new SelectablePdfData<PlatformMember>({
                    id: `recordAnswers.${record.id}`,
                    name: record.name.toString(),
                    category: category.name.toString(),
                    enabled: false,
                    description: record.description.toString(),
                    getValue: ({ patchedMember: object }: PlatformMember) => {
                        // todo: multiple values possible?
                        return object.details.recordAnswers.get(record.id)?.stringValue;
                    },
                });
            });
        }),
    ].filter(column => column !== null);

    return columns;
}

export function getSelectableGroupPdfData(groups: Group[] = []) {
    const groupColumns: SelectablePdfData<PlatformMember>[] = [];

    for (const group of groups) {
        const getRegistration = (object: PlatformMember) => object.filterRegistrations({ groupIds: [group.id] })[0] ?? null;

        if (group.settings.prices.length > 1) {
            groupColumns.push(
                new SelectablePdfData<PlatformMember>({
                    id: `groups.${group.id}.price`,
                    name: $t(`a5ecc2e0-c1f2-4cfb-b4b2-8a17782787bc`),
                    category: group.settings.name.toString(),
                    enabled: false,
                    getValue: (object: PlatformMember) => getRegistration(object)?.groupPrice.name.toString(),
                }),
            );
        }

        for (const menu of group.settings.optionMenus) {
            groupColumns.push(
                new SelectablePdfData<PlatformMember>({
                    id: `groups.${group.id}.optionMenu.${menu.id}`,
                    name: menu.name,
                    category: group.settings.name.toString(),
                    enabled: false,
                    getValue: (member: PlatformMember) => {
                        const registration = getRegistration(member);
                        if (!registration) {
                            return null;
                        }

                        const menuId = menu.id;

                        const options = registration.options.filter(o => o.optionMenu.id === menuId);

                        if (!options.length) {
                            return null;
                        }

                        return options.map(option => (option.amount > 1 ? `${option.amount}x ` : '') + option.option.name).join(', ');
                    },
                }),
            );

            for (const option of menu.options) {
                if (option.allowAmount) {
                    groupColumns.push(
                        new SelectablePdfData<PlatformMember>({
                            id: `groups.${group.id}.optionMenu.${menu.id}.${option.id}.amount`,
                            name: menu.name + ' → ' + option.name + ' → ' + $t('697df3e7-fbbf-421d-81c2-9c904dce4842'),
                            category: group.settings.name.toString(),
                            enabled: false,
                            getValue: (member: PlatformMember) => {
                                const registration = getRegistration(member);
                                if (!registration) {
                                    return null;
                                }

                                const menuId = menu.id;

                                const options = registration.options.filter(o => o.optionMenu.id === menuId);

                                if (!options.length) {
                                    return null;
                                }

                                return options.map(option => (option.amount > 1 ? `${option.amount}x ` : '') + option.option.name).join(', ');
                            },
                        }),
                    );
                }
            }
        }

        for (const recordCategory of group.settings.recordCategories) {
            const records = recordCategory.getAllRecords();

            for (const record of records) {
                groupColumns.push(
                    new SelectablePdfData<PlatformMember>({
                        id: `groups.${group.id}.recordAnswers.${record.id}`,
                        name: recordCategory.name + ' → ' + record.name,
                        category: group.settings.name.toString(),
                        enabled: false,
                        getValue: (member: PlatformMember) => {
                            const registration = getRegistration(member);
                            if (!registration) {
                                return null;
                            }
                            return registration.recordAnswers.get(record.id)?.stringValue;
                        },
                    }),
                );
            }
        }
    }

    return groupColumns;
}

export function getAllSelectablePdfDataForMemberDetails(args: { platform: Platform; organization: Organization | null; groups?: Group[]; auth: ContextPermissions }) {
    const groupColumns = getSelectableGroupPdfData(args.groups ?? []);
    return getSelectablePdfData({ ...args, groupColumns });
}

export function getAllSelectablePdfDataForSummary({ platform, organization, auth, groups }: { platform: Platform; organization: Organization | null; auth: ContextPermissions; groups?: Group[] }) {
    const recordCategories = [
        ...(organization?.meta.recordsConfiguration.recordCategories ?? []),
        ...platform.config.recordsConfiguration.recordCategories,
    ];

    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    const financialSupportSettings = platform.config.financialSupport ?? FinancialSupportSettings.create({});
    const financialSupportTitle = financialSupportSettings.title;

    const returnNullIfNoAccessRight = returnNullIfNoAccessRightFactory(auth);

    const columns: SelectablePdfData<PlatformMember>[] = [
        returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
            id: 'requiresFinancialSupport',
            name: financialSupportTitle,
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.requiresFinancialSupport?.value ? '' : null,
        }), [AccessRight.MemberReadFinancialData]),
        new SelectablePdfData<PlatformMember>({
            id: 'dataPermissions',
            name: $t('74956434-5a54-4a93-82df-08533d1a6963'),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.dataPermissions?.value ? null : '',
        }),
    ].filter(column => column !== null);

    flattenedCategories.forEach((recordCategory) => {
        const categoryName = recordCategory.name.toString();
        columns.push(...getSelectabelPdfDataFromRecordCatagoryForSummary({ recordCategory, categoryName,
            getBaseId: (record: RecordSettings) => `recordAnswers.${record.id}`,
            getBaseName: (record: RecordSettings) => record.name.toString(),
        }));
    });

    for (const group of groups ?? []) {
        group.settings.recordCategories.forEach((recordCategory) => {
            const categoryName = group.settings.name.toString();
            columns.push(...getSelectabelPdfDataFromRecordCatagoryForSummary({ recordCategory, categoryName,
                getBaseId: (record: RecordSettings) => `groups.${group.id}.recordAnswers.${record.id}`,
                getBaseName: (record: RecordSettings) => recordCategory.name + ' → ' + record.name,
            }));
        });
    }

    return columns;
}

function getSelectabelPdfDataFromRecordCatagoryForSummary({ recordCategory, categoryName: category, getBaseId, getBaseName }: { recordCategory: RecordCategory; categoryName: string | undefined; getBaseId: (record: RecordSettings) => string; getBaseName: (record: RecordSettings) => string }): SelectablePdfData<PlatformMember>[] {
    return recordCategory.getAllRecords().flatMap((record) => {
        const baseId = getBaseId(record);
        const baseName = getBaseName(record);
        const type = record.type;

        switch (type) {
            case RecordType.Checkbox: {
                const preferInverted = record.warning?.inverted ?? false;

                return [
                    new SelectablePdfData<PlatformMember>({
                        id: `${baseId}.checked`,
                        name: `${baseName}: ${$t('e81e0ffa-8ed9-4382-bc07-479728006648')}`,
                        enabled: !preferInverted && !!record.warning,
                        category,
                        getValue: ({ patchedMember: object }: PlatformMember) => {
                            const answer = object.details.recordAnswers.get(record.id);
                            if (answer instanceof RecordCheckboxAnswer) {
                                return answer.selected ? (answer.comments ?? '') : null;
                            }
                            return null;
                        },
                    }), new SelectablePdfData<PlatformMember>({
                        id: `${baseId}.notChecked`,
                        name: `${baseName}: ${$t('8abc595b-a705-499b-b4a2-17cb3cf99e47')}`,
                        enabled: preferInverted && !!record.warning,
                        category,
                        getValue: ({ patchedMember: object }: PlatformMember) => {
                            const answer = object.details.recordAnswers.get(record.id);
                            if (answer instanceof RecordCheckboxAnswer) {
                                return answer.selected ? null : '';
                            }
                            return '';
                        },
                    }),
                ];
            }
            case RecordType.ChooseOne: {
                return record.choices.map((choice) => {
                    return new SelectablePdfData<PlatformMember>({
                        id: `${baseId}.${choice.id}`,
                        name: `${baseName}: ${choice.name.toString()}`,
                        enabled: !!choice.warning,
                        category,
                        getValue: ({ patchedMember: object }: PlatformMember) => {
                            const answer = object.details.recordAnswers.get(record.id);
                            if (answer instanceof RecordChooseOneAnswer) {
                                return answer.selectedChoice?.id === choice.id ? '' : null;
                            }
                            return null;
                        },
                    });
                });
            }
            case RecordType.MultipleChoice: {
                return record.choices.map((choice) => {
                    return new SelectablePdfData<PlatformMember>({
                        id: `${baseId}.${choice.id}`,
                        name: `${baseName}: ${choice.name.toString()}`,
                        enabled: !!choice.warning,
                        category,
                        getValue: ({ patchedMember: object }: PlatformMember) => {
                            const answer = object.details.recordAnswers.get(record.id);
                            if (answer instanceof RecordMultipleChoiceAnswer) {
                                return answer.selectedChoices.find(c => c.id === choice.id) ? '' : null;
                            }
                            return null;
                        },
                    });
                });
            }
            default: {
                return [
                    new SelectablePdfData<PlatformMember>({
                        id: baseId,
                        name: baseName,
                        enabled: !!record.warning,
                        category,
                        getValue: ({ patchedMember: object }: PlatformMember) => {
                            const answer = object.details.recordAnswers.get(record.id);
                            if (!answer) {
                                return null;
                            }

                            const value = answer.stringValue.trim();
                            return value && value !== '/' && value.toLowerCase() !== 'nee' && value.toLowerCase() !== 'neen' && value.toLowerCase() !== 'nvt' && value.toLowerCase() !== 'n.v.t.' ? value : null;
                        },
                    }),
                ];
            }
        }
    });
}
