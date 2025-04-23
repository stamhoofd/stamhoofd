import { XlsxTransformerColumn } from '@stamhoofd/excel-writer';
import { Address, CountryHelper, Parent, ParentTypeHelper, PlatformMember, RecordAnswer, RecordCategory, RecordSettings, RecordType } from '@stamhoofd/structures';

export class XlsxTransformerColumnHelper {
    static formatBoolean(value: boolean | undefined | null): string {
        if (value === true) {
            return $t(`1ae8cbc7-9ef5-43db-b9a3-0117dfa43be1`);
        }

        if (value === false) {
            return $t(`b8b730fb-f1a3-4c13-8ec4-0aebe08a1449`);
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
                name: getName($t(`f97ad8c1-31d2-4b61-9e09-3be86eaeba08`)),
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
                name: getName($t(`efca0579-0543-4636-a996-384bc9f0527e`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.firstName ?? '',
                }),
            },
            {
                id: getId('lastName'),
                name: getName($t(`4a5e438e-08a1-411e-9b66-410eea7ded73`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.lastName ?? '',
                }),
            },
            {
                id: getId('phone'),
                name: getName($t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.phone ?? '',
                }),
            },
            {
                id: getId('email'),
                name: getName($t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`)),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.email ?? '',
                }),
            },
            {
                id: getId('nationalRegisterNumber'),
                name: getName($t(`00881b27-7501-4c56-98de-55618be2bf11`)),
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
                            defaultCategory: $t(`2f10996e-ea97-4345-b997-c93198c7d67f`), // Ignore this name
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
                            name: $t(`cc1cf4a7-0bd2-4fa7-8ff2-0a12470a738d`),
                            defaultCategory: $t(`2f10996e-ea97-4345-b997-c93198c7d67f`), // Ignore this name
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
                            name: $t(`dafc7b04-dfb2-4dbc-8bcf-f7e9c6356442`),
                            defaultCategory: $t(`2f10996e-ea97-4345-b997-c93198c7d67f`), // Ignore this name
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
                            name: $t(`3d538399-3585-4be6-b03d-c12afa7183e8`),
                            defaultCategory: $t(`2f10996e-ea97-4345-b997-c93198c7d67f`), // Ignore this name
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
                            name: $t(`cce830e0-6c05-405f-a800-4c217dc3235f`),
                            defaultCategory: $t(`2f10996e-ea97-4345-b997-c93198c7d67f`), // Ignore this name
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
