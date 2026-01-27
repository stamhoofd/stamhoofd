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
            name: $t('7c4ca473-3c49-45fb-bdd2-b87399a69e62'),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.memberNumber,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'firstName',
            name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.firstName,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'lastName',
            name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.lastName,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'birthDay',
            name: $t(`f3b87bd8-e36c-4fb8-917f-87b18ece750e`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.birthDay,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'age',
            name: $t(`e96d9ea7-f8cc-42c6-b23d-f46e1a56e043`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.age,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'gender',
            enabled: false,
            name: $t(`3048ad16-fd3b-480e-b458-10365339926b`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                getGenderName(object.details.gender),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'phone',
            name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.phone,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'email',
            enabled: false,
            name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.email,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'address',
            name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
            description: $t(`01e99208-dce7-4109-8cf2-3cc74c4df45c`),
            // todo: check if this is correct?
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.address?.toString(),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'securityCode',
            name: $t(`ba5f8036-1788-408a-8c44-1db80a53c087`),
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
            name: $t(`d70f2a7f-d8b4-4846-8dc0-a8e978765b9d`),
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
            name: $t(`439176a5-dd35-476b-8c65-3216560cac2f`),
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
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                            return str;
                        },
                    }),
                    new SelectablePdfData<PlatformMember>({
                        id: 'uri',
                        name: $t(`4c61c43e-ed3c-418e-8773-681d19323520`),
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
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
                    )
                    || $t('1a16a32a-7ee4-455d-af3d-6073821efa8f');

                            return str;
                        },
                    }),
                    new SelectablePdfData<PlatformMember>({
                        id: 'defaultAgeGroup',
                        name: $t(`494ad9b9-c644-4b71-bd38-d6845706231f`),
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
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
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
                        name: $t(`fb629dba-088e-4c97-b201-49787bcda0ac`),
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
                        ' ' + $t(`c1843768-2bf4-42f2-baa4-42f49028463d`) + ' ',
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
                    name: $t(`ca52d8d3-9a76-433a-a658-ec89aeb4efd5`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.firstName,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('lastName'),
                    name: $t(`171bd1df-ed4b-417f-8c5e-0546d948469a`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.lastName,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('phone'),
                    name: $t(`de70b659-718d-445a-9dca-4d14e0a7a4ec`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.phone,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('email'),
                    name: $t(`7400cdce-dfb4-40e7-996b-4817385be8d8`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.email,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('address'),
                    name: $t(`f7e792ed-2265-41e9-845f-e3ce0bc5da7c`),
                    category,
                    enabled,
                    // todo: check if this is correct?
                    getValue: (object: PlatformMember) => getParent(object)?.address?.toString(),

                }),
                returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`439176a5-dd35-476b-8c65-3216560cac2f`),
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
            name: $t(`7766ee8a-cd92-4d6f-a3fa-f79504fbcdda`),
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
                    name: $t(`ae21b9bf-7441-4f38-b789-58f34612b7af`),
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
                            name: menu.name + ' → ' + option.name + ' → ' + $t('ed55e67d-1dce-46b2-8250-948c7cd616c2'),
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
