import { XlsxTransformerColumn } from '@stamhoofd/excel-writer';
import { Address, CountryHelper, Parent, ParentTypeHelper, PlatformMember, RecordAnswer, RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';

export class XlsxTransformerColumnHelper {
    static formatBoolean(value: boolean | undefined | null): string {
        if (value === true) {
            return $t(`Ja`);
        }

        if (value === false) {
            return $t(`Nee`);
        }

        return '';
    }

    static creatColumnsForParents(): XlsxTransformerColumn<PlatformMember>[] {
        return [
            ...this.createColumnsForParent(0),
            ...this.createColumnsForParent(1),
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
                name: getName($t(`Type`)),
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
                name: getName($t(`Voornaam`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.firstName ?? '',
                }),
            },
            {
                id: getId('lastName'),
                name: getName($t(`Achternaam`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.lastName ?? '',
                }),
            },
            {
                id: getId('phone'),
                name: getName($t(`Telefoonnummer`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.phone ?? '',
                }),
            },
            {
                id: getId('email'),
                name: getName($t(`E-mailadres`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.email ?? '',
                }),
            },
            {
                id: getId('nationalRegisterNumber'),
                name: getName($t(`Rijksregisternummer`)),
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
                            defaultCategory: $t(`Adres`), // Ignore this name
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
                            name: $t(`Nummer`),
                            defaultCategory: $t(`Adres`), // Ignore this name
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
                            name: $t(`Postcode`),
                            defaultCategory: $t(`Adres`), // Ignore this name
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
                            name: $t(`Stad`),
                            defaultCategory: $t(`Adres`), // Ignore this name
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
                            name: $t(`Land`),
                            defaultCategory: $t(`Adres`), // Ignore this name
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
                            category: recordCategory.name,
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
}
