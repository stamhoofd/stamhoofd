import type { XlsxTransformerColumn, XlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import { isXlsxTransformerConcreteColumn } from '@stamhoofd/excel-writer';
import type { Address, EmergencyContact, GroupCategory, Parent, PlatformMember, RecordAnswer, RecordSettings } from '@stamhoofd/structures';
import { CountryHelper, ParentTypeHelper, RecordCategory, RecordType } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

export class XlsxTransformerColumnHelper {
    static formatBoolean(value: boolean | undefined | null): string {
        if (value === true) {
            return $t(`%wo`);
        }

        if (value === false) {
            return $t(`%18s`);
        }

        return '';
    }

    static creatColumnsForParents(): XlsxTransformerColumn<PlatformMember>[] {
        return [
            ...this.createColumnsForParent(0),
            ...this.createColumnsForParent(1),
        ];
    }

    /**
     * Emergency contacts are an unbounded array, so only the first two get their own columns. The combined
     * 'emergencyContacts' column in the members loader lists all of them.
     */
    static createColumnsForEmergencyContacts(): XlsxTransformerColumn<PlatformMember>[] {
        return [
            ...this.createColumnsForEmergencyContact(0),
            ...this.createColumnsForEmergencyContact(1),
        ];
    }

    static createColumnsForEmergencyContact(contactIndex: number): XlsxTransformerColumn<PlatformMember>[] {
        const getContact = (member: PlatformMember): EmergencyContact | null | undefined => member.patchedMember.details.emergencyContacts[contactIndex];

        const identifier = `Noodcontact ${contactIndex + 1}`;
        const getId = (value: string) => `emergencyContact.${contactIndex}.${value}`;
        const getName = (value: string) => `${identifier} - ${value}`;

        return [
            {
                id: getId('name'),
                name: getName($t(`Naam`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getContact(member)?.name ?? '',
                }),
            },
            {
                id: getId('title'),
                name: getName($t(`Relatie`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getContact(member)?.title ?? '',
                }),
            },
            {
                id: getId('phone'),
                name: getName($t(`%wD`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getContact(member)?.phone ?? '',
                }),
            },
        ];
    }

    static createColumnsForAddresses<T>({ limit, getAddresses, matchIdStart }: { limit: number; getAddresses: (object: T) => Address[]; matchIdStart: string }): XlsxTransformerColumn<T>[] {
        const result: XlsxTransformerColumn<unknown>[] = [];

        for (let i = 0; i <= limit; i++) {
            const column = this.createAddressColumns({
                matchId: `${matchIdStart}.${i}`,
                getAddress: (object: T) => getAddresses(object)[i],
            });

            result.push(column);
        }

        return result;
    }

    static createColumnsForParent(parentIndex: number): XlsxTransformerColumn<PlatformMember>[] {
        const getParent = (member: PlatformMember): Parent | null | undefined => member.patchedMember.details.parents[parentIndex];

        const parentNumber = parentIndex + 1;

        const identifier = `Ouder ${parentNumber}`;
        const getId = (value: string) => `parent.${parentIndex}.${value}`;
        const getName = (value: string) => `${identifier} - ${value}`;

        return [
            {
                id: getId('type'),
                name: getName($t(`%1B`)),
                width: 20,
                getValue: (member: PlatformMember) => {
                    const parent = getParent(member);

                    return {
                        value: parent ? ParentTypeHelper.getName(parent.type) : '',
                    };
                },
            },
            {
                id: getId('firstName'),
                name: getName($t(`%1MT`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.firstName ?? '',
                }),
            },
            {
                id: getId('lastName'),
                name: getName($t(`%1MU`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.lastName ?? '',
                }),
            },
            {
                id: getId('phone'),
                name: getName($t(`%wD`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.phone ?? '',
                }),
            },
            {
                id: getId('email'),
                name: getName($t(`%1FK`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.email ?? '',
                }),
            },
            {
                id: getId('nationalRegisterNumber'),
                name: getName($t(`%wK`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.nationalRegisterNumber?.toString() ?? '',
                }),
            },
            XlsxTransformerColumnHelper.createAddressColumns<PlatformMember>({
                matchId: getId('address'),
                getAddress: member => getParent(member)?.address,
            }),
        ];
    }

    static createAddressColumns<T>({ matchId, getAddress }: { matchId: string; getAddress: (object: T) => Address | null | undefined }): XlsxTransformerColumn<T> {
        const getId = (value: string) => matchId + '.' + value;

        return {
            match: (id) => {
                if (id === matchId) {
                    return [
                        {
                            id: getId('street'),
                            name: `Straat`,
                            defaultCategory: $t(`%Cn`), // Ignore this name
                            width: 40,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.street || '',
                                };
                            },
                        },
                        {
                            id: getId('number'),
                            name: $t(`%cH`),
                            defaultCategory: $t(`%Cn`), // Ignore this name
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.number || '',
                                };
                            },
                        },
                        {
                            id: getId('postalCode'),
                            name: $t(`%c`),
                            defaultCategory: $t(`%Cn`), // Ignore this name
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.postalCode || '',
                                };
                            },
                        },
                        {
                            id: getId('city'),
                            name: $t(`%wp`),
                            defaultCategory: $t(`%Cn`), // Ignore this name
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.city || '',
                                };
                            },
                        },
                        {
                            id: getId('country'),
                            name: $t(`%Cp`),
                            defaultCategory: $t(`%Cn`), // Ignore this name
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                const country = address?.country;
                                return {
                                    value: country ? CountryHelper.getName(country) : '',
                                };
                            },
                        },
                    ];
                }
            },
        };
    }

    static createRecordAnswersColumns<T>({ matchId, getRecordCategories, getRecordAnswers }: { matchId: string; getRecordCategories: () => RecordCategory[]; getRecordAnswers: (object: T) => Map<string, RecordAnswer> }): XlsxTransformerColumn<T> {
        return {
            match(id) {
                if (id.startsWith(matchId + '.')) {
                    const recordCategories = getRecordCategories();
                    const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

                    let recordCategory: RecordCategory | undefined;
                    let recordSetting: RecordSettings | undefined;
                    const recordSettingId = id.split('.')[1];

                    for (const category of flattenedCategories) {
                        const recordSettings = category.getAllRecords();
                        const rr = recordSettings.find(r => r.id === recordSettingId);

                        if (rr) {
                            recordSetting = rr;
                            recordCategory = category;
                            break;
                        }
                    }

                    if (!recordSetting || !recordCategory) {
                        // Will throw a proper error itself
                        console.log('recordSetting not found');
                        return;
                    }

                    const columns = recordSetting.excelColumns;

                    return columns.map(({ name, width, defaultCategory }, index) => {
                        return {
                            id: `${matchId}.${recordSettingId}.${index}`,
                            name,
                            width: width ?? 20,
                            defaultCategory,
                            category: recordCategory.name.toString(),
                            getValue: (object: T) => {
                                const answers = getRecordAnswers(object);
                                const b = (answers.get(recordSettingId)?.excelValues[index] ?? {
                                    value: '',
                                });

                                return {
                                    ...b,
                                    style: {
                                        ...b.style,
                                        alignment: {
                                            ...b.style?.alignment,
                                            wrapText: recordSetting.type === RecordType.Textarea,
                                        },
                                    },
                                };
                            },
                        };
                    });
                }
            },
        };
    }

    /**
     * Creates a dynamic column for a group category. The matched id is `${matchId}.${categoryId}`, where categoryId
     * refers to a category in the current period of the organization the member is registered at. The value is a
     * comma separated list of all the groups the member is registered for in the current period that belong to that
     * category (including its subcategories).
     */
    static createGroupCategoryColumns<T>({ matchId, getMember }: { matchId: string; getMember: (object: T) => PlatformMember }): XlsxTransformerColumn<T> {
        return {
            match(id) {
                if (!id.startsWith(matchId + '.')) {
                    return;
                }

                const categoryId = id.substring(matchId.length + 1);
                if (!categoryId) {
                    return;
                }

                return [
                    {
                        id: `${matchId}.${categoryId}`,
                        name: $t(`%M2`),
                        width: 40,
                        getValue: (object: T) => {
                            const member = getMember(object);

                            for (const organization of member.organizations) {
                                const categories = organization.period.settings.categories;
                                if (!categories.find(c => c.id === categoryId)) {
                                    continue;
                                }

                                const groupIds = XlsxTransformerColumnHelper.collectGroupIdsForCategory(categoryId, categories);
                                const registrations = member.filterRegistrations({ groupIds, organizationId: organization.id });
                                const names = Formatter.uniqueArray(registrations.map(r => r.group.settings.name.toString())).sort();

                                return {
                                    value: names.join(', '),
                                };
                            }

                            return {
                                value: '',
                            };
                        },
                    },
                ];
            },
        };
    }

    /**
     * Recursively collects all group ids that belong to a category and its subcategories.
     */
    private static collectGroupIdsForCategory(categoryId: string, categories: GroupCategory[], seen = new Set<string>()): string[] {
        if (seen.has(categoryId)) {
            return [];
        }
        seen.add(categoryId);

        const category = categories.find(c => c.id === categoryId);
        if (!category) {
            return [];
        }

        return [
            ...category.groupIds,
            ...category.categoryIds.flatMap(id => XlsxTransformerColumnHelper.collectGroupIdsForCategory(id, categories, seen)),
        ];
    }

    /**
     * Makes it possible to reuse an XlsxTransformerColumn, for example member columns exist, PlatformRegistration has
     * a property member, so we can reuse the member columns for PlatformRegistration.
     * @param param0
     * @returns
     */
    private static transformConcreteColumnForProperty<T, O>({ column, key, getPropertyValue }: { column: XlsxTransformerConcreteColumn<T>; key: string; getPropertyValue: (object: O) => T }): XlsxTransformerConcreteColumn<O> {
        return {
            ...column,
            id: `${key}.${column.id}`,
            getValue: (object: O) => column.getValue(getPropertyValue(object)),
        };
    }

    /**
     * Makes it possible to reuse an XlsxTransformerColumn, for example member columns exist, PlatformRegistration has
     * a property member, so we can reuse the member columns for PlatformRegistration.
     * @param param0
     * @returns
     */
    static transformColumnForProperty<T, O>({ column, key, getPropertyValue }: { column: XlsxTransformerColumn<T>; key: string; getPropertyValue: (object: O) => T }): XlsxTransformerColumn<O> {
        if (isXlsxTransformerConcreteColumn(column)) {
            return this.transformConcreteColumnForProperty({ column, key, getPropertyValue });
        }

        return {
            match: (id: string) => {
                if (!id.startsWith(key + '.')) {
                    return;
                }

                const subId = id.substring(key.length + 1);
                const subColumns = column.match(subId);

                if (!subColumns) {
                    return;
                }

                return subColumns.map(column => XlsxTransformerColumnHelper.transformConcreteColumnForProperty({ column, key, getPropertyValue }));
            },
        };
    }
}
