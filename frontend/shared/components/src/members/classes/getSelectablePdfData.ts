import { SelectableColumn } from '@stamhoofd/frontend-excel-export';
import { ContextPermissions } from '@stamhoofd/networking/ContextPermissions';
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
            name: $t(`%1P`),
            description: $t(`%ev`),
            enabled: false,
            getValue: member => member.id,
        }),
        // todo: only if platform?
        new SelectablePdfData<PlatformMember>({
            id: 'memberNumber',
            name: $t('%19j'),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.memberNumber,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'firstName',
            name: $t(`%1MT`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.firstName,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'lastName',
            name: $t(`%1MU`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.lastName,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'birthDay',
            name: $t(`%17w`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.birthDay,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'age',
            name: $t(`%9S`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.age,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'gender',
            enabled: false,
            name: $t(`%19i`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                getGenderName(object.details.gender),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'phone',
            name: $t(`%wD`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.phone,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'email',
            enabled: false,
            name: $t(`%1FK`),
            getValue: ({ patchedMember: object }: PlatformMember) =>
                object.details.email,
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'address',
            name: $t(`%Cn`),
            description: $t(`%ew`),
            // todo: check if this is correct?
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.address?.toString(),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'securityCode',
            name: $t(`%wE`),
            enabled: false,
            description: $t(`%ex`),
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
            name: $t(`%wF`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.uitpasNumberDetails?.uitpasNumber,
        }), [AccessRight.MemberReadFinancialData]),

        new SelectablePdfData<PlatformMember>({
            id: 'notes',
            name: $t(`%Ve`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.notes,
        }),
        returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
            id: 'nationalRegisterNumber',
            enabled: false,
            name: $t(`%wK`),
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.nationalRegisterNumber?.toString() ?? '',
        }), [AccessRight.MemberManageNRN]),

        ...(groupColumns ?? []),

        ...(!organization
            ? [
                    new SelectablePdfData<PlatformMember>({
                        id: 'organization',
                        name: $t(`%ey`),
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
                        ' ' + $t(`%M1`) + ' ',
                    )
                    || $t('%5D');

                            return str;
                        },
                    }),
                    new SelectablePdfData<PlatformMember>({
                        id: 'uri',
                        name: $t(`%7C`),
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
                        ' ' + $t(`%M1`) + ' ',
                    )
                    || $t('%5D');

                            return str;
                        },
                    }),
                    new SelectablePdfData<PlatformMember>({
                        id: 'defaultAgeGroup',
                        name: $t(`%wI`),
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
                                    )?.name ?? $t(`%wJ`),
                            );
                            const str
                    = Formatter.joinLast(
                        Formatter.uniqueArray(defaultAgeGroups).sort(),
                        ', ',
                        ' ' + $t(`%M1`) + ' ',
                    )
                    || $t('%5D');

                            return str;
                        },
                    }),
                ]
            : []),

        ...(organization
            ? [
                    new SelectablePdfData<PlatformMember>({
                        id: 'group',
                        name: $t(`%wH`),
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
                        ' ' + $t(`%M1`) + ' ',
                    )
                    || $t('%5D');

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
                    name: $t(`%1B`),
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
                    name: $t(`%1MT`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.firstName,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('lastName'),
                    name: $t(`%1MU`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.lastName,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('phone'),
                    name: $t(`%wD`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.phone,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('email'),
                    name: $t(`%1FK`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.email,
                }),
                new SelectablePdfData<PlatformMember>({
                    id: getId('address'),
                    name: $t(`%Cn`),
                    category,
                    enabled,
                    // todo: check if this is correct?
                    getValue: (object: PlatformMember) => getParent(object)?.address?.toString(),

                }),
                returnNullIfNoAccessRight(new SelectablePdfData<PlatformMember>({
                    id: getId('nationalRegisterNumber'),
                    name: $t(`%wK`),
                    category,
                    enabled,
                    getValue: (object: PlatformMember) => getParent(object)?.nationalRegisterNumber?.toString(),
                }), [AccessRight.MemberManageNRN]),
            ];
        }),

        new SelectablePdfData<PlatformMember>({
            id: 'unverifiedPhones',
            name: $t(`%ez`),
            category: $t(`%f0`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedPhones.join(', '),
        }),
        new SelectablePdfData<PlatformMember>({
            id: 'unverifiedEmails',
            name: $t(`%vG`),
            category: $t(`%f0`),
            enabled: false,
            getValue: ({ patchedMember: object }: PlatformMember) => object.details.unverifiedEmails.join(', '),
        }),

        ...[1, 2].map((number, index) => {
            return new SelectablePdfData<PlatformMember>({
                id: `unverifiedAddresses.${index}`,
                name: `Adres ${number}`,
                category: $t(`%f0`),
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
                    name: $t(`%62`),
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
                            name: menu.name + ' → ' + option.name + ' → ' + $t('%M4'),
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
            name: $t('%17X'),
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
                        name: `${baseName}: ${$t('%17Y')}`,
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
                        name: `${baseName}: ${$t('%17Z')}`,
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
