import { Address, CountryHelper, Parent, ParentTypeHelper, PlatformMember } from '@stamhoofd/structures';
import { MatchItems } from '../dictionaries';
import { ExportItem } from '../types';

type AddressMatchItems<T> = MatchItems<T, Address | null | undefined, 'street' | 'number' | 'postalCode' | 'city' | 'country'>;

export class ExportItemHelper {
    static createAddressMatchItems<T>({
        matchId,
        getAddress,
    }: {
        matchId: string;
        getAddress: (object: T) => Address | null | undefined;
    }): AddressMatchItems<T> {
        const getId = (value: string) => matchId + '.' + value;

        const itemMatch: MatchItems<T, Address | null | undefined, 'street' | 'number' | 'postalCode' | 'city' | 'country'> = {
            isMatch: (id: string) => id === matchId,
            getMatchedValue: (object: T) => getAddress(object),
            records: {
                street: {
                    getMatchedRecordItem: (id: string) => ({
                        id: getId('street'),
                        name: `Straat`,
                        getValue: (address: Address | null) =>
                            address?.street || '',
                    }),
                },
                number: {
                    getMatchedRecordItem: (id: string) => ({
                        id: getId('number'),
                        name: $t(`cc1cf4a7-0bd2-4fa7-8ff2-0a12470a738d`),
                        getValue: (address: Address | null) =>
                            address?.number || '',
                    }),
                },
                postalCode: {
                    getMatchedRecordItem: (id: string) => ({
                        id: getId('postalCode'),
                        name: $t(`dafc7b04-dfb2-4dbc-8bcf-f7e9c6356442`),
                        getValue: (address: Address | null) =>
                            address?.postalCode || '',
                    }),
                },
                city: {
                    getMatchedRecordItem: (id: string) => ({
                        id: getId('city'),
                        name: $t(`3d538399-3585-4be6-b03d-c12afa7183e8`),
                        getValue: (address: Address | null) =>
                            address?.city || '',
                    }),
                },
                country: {
                    getMatchedRecordItem: (id: string) => ({
                        id: getId('country'),
                        name: $t(`cce830e0-6c05-405f-a800-4c217dc3235f`),
                        getValue: (address: Address | null) => {
                            const country = address?.country;
                            return country
                                ? CountryHelper.getName(country)
                                : '';
                        },
                    }),
                },
            },
        };

        return itemMatch;
    }

    static createMultipleAddressMatchItems<T>({ limit, getAddresses, matchIdStart }: { limit: number; getAddresses: (object: T) => Address[]; matchIdStart: string }): AddressMatchItems<T>[] {
        const result: MatchItems<T, Address | null | undefined>[] = [];

        // todo: what is meaning of limit? should this be < limit instead?
        for (let i = 0; i <= limit; i++) {
            const column = this.createAddressMatchItems({
                matchId: `${matchIdStart}.${i}`,
                getAddress: (object: T) => getAddresses(object)[i],
            });

            result.push(column);
        }

        return result;
    }

    static creatExportItemsForParents(): Record<'parent.type' | 'parent.firstName' | 'parent.lastName' | 'parent.phone' | 'parent.email' | 'parent.nationalRegisterNumber', { customId: string; value: ExportItem<PlatformMember> }[]> {
        const parentIndexes = [0, 1];

        const getParent = (member: PlatformMember, parentIndex: number): Parent | null | undefined =>
            member.patchedMember.details.parents[parentIndex];

        const getId = (value: string, parentIndex) => `parent.${parentIndex}.${value}`;
        const getName = (value: string, parentIndex: number) => {
            const parentNumber = parentIndex + 1;
            const identifier = `Ouder ${parentNumber}`;

            return `${identifier} - ${value}`;
        };

        const createItems = ({ id, name, getValue }: { id: string; name: string; getValue: (parent: Parent | null | undefined) => string }) => {
            return parentIndexes.map((parentIndex) => {
                return {
                    customId: getId(id, parentIndex),
                    value: {
                        name: getName(name, parentIndex),
                        getValue: (member: PlatformMember) => {
                            const parent = getParent(member, parentIndex);
                            return getValue(parent);
                        },
                    },
                };
            });
        };

        return {
            'parent.type': createItems({
                id: 'type',
                name: $t(`f97ad8c1-31d2-4b61-9e09-3be86eaeba08`),
                getValue: (parent) => {
                    return parent
                        ? ParentTypeHelper.getName(parent.type)
                        : '';
                },
            }),
            'parent.firstName': createItems({
                id: 'firstName',
                name: $t(`efca0579-0543-4636-a996-384bc9f0527e`),
                getValue: parent => parent?.firstName ?? '',
            }),
            'parent.lastName': createItems({
                id: 'lastName',
                name: $t(`4a5e438e-08a1-411e-9b66-410eea7ded73`),
                getValue: parent => parent?.lastName ?? '',
            }),
            'parent.phone': createItems({
                id: 'phone',
                name: $t(`856aaa1c-bc62-4e45-9ae5-4c7e7dca23ab`),
                getValue: parent => parent?.phone ?? '',
            }),
            'parent.email': createItems({
                id: 'email',
                name: $t(`82f4b6ed-afee-4655-9f07-22802e0e7ad9`),
                getValue: parent => parent?.email ?? '',
            }),
            'parent.nationalRegisterNumber': createItems({
                id: 'nationalRegisterNumber',
                name: $t(`00881b27-7501-4c56-98de-55618be2bf11`),
                getValue: parent => parent?.nationalRegisterNumber?.toString() ?? '',
            }),

        };
    }

    static createAddressMatchItemsForParents(): AddressMatchItems<PlatformMember>[] {
        return [0, 1].map(parentIndex => this.createAddressMatchItems({
            matchId: `parent.${parentIndex}.address`,
            getAddress: (member: PlatformMember) => member.patchedMember.details.parents[parentIndex]?.address,
        }));
    }

    // static createRecordAnswersMatchItems<T>({ matchId, getRecordCategories, getRecordAnswers }: { matchId: string; getRecordCategories: () => RecordCategory[]; getRecordAnswers: (object: T) => Map<string, RecordAnswer> }): MatchItems<T> {
    //     const test: MatchItems<T, Map<string, RecordAnswer>> = {
    //         isMatch(id: string) {
    //             return id.startsWith(matchId + '.');
    //         },
    //         getMatchedValue(object: T) {
    //             return getRecordAnswers(object);
    //         },
    //         records: {

    //         },
    //     };

    //     return {
    //         match(id) {
    //             if (id.startsWith(matchId + '.')) {
    //                 const recordCategories = getRecordCategories();
    //                 const flattenedCategories = RecordCategory.flattenCategoriesWith(recordCategories, r => r.excelColumns.length > 0);

    //                 let recordCategory: RecordCategory | undefined;
    //                 let recordSetting: RecordSettings | undefined;
    //                 const recordSettingId = id.split('.')[1];

    //                 for (const category of flattenedCategories) {
    //                     const recordSettings = category.getAllRecords();
    //                     const rr = recordSettings.find(r => r.id === recordSettingId);

    //                     if (rr) {
    //                         recordSetting = rr;
    //                         recordCategory = category;
    //                         break;
    //                     }
    //                 }

    //                 if (!recordSetting || !recordCategory) {
    //                     // Will throw a proper error itself
    //                     console.log('recordSetting not found');
    //                     return;
    //                 }

    //                 const columns = recordSetting.excelColumns;

    //                 return columns.map(({ name, width, defaultCategory }, index) => {
    //                     return {
    //                         id: `${matchId}.${recordSettingId}.${index}`,
    //                         name,
    //                         width: width ?? 20,
    //                         defaultCategory,
    //                         category: recordCategory.name.toString(),
    //                         getValue: (object: T) => {
    //                             const answers = getRecordAnswers(object);
    //                             const b = (answers.get(recordSettingId)?.excelValues[index] ?? {
    //                                 value: '',
    //                             });

    //                             return {
    //                                 ...b,
    //                                 style: {
    //                                     ...b.style,
    //                                     alignment: {
    //                                         ...b.style?.alignment,
    //                                         wrapText: recordSetting.type === RecordType.Textarea,
    //                                     },
    //                                 },
    //                             };
    //                         },
    //                     };
    //                 });
    //             }
    //         },
    //     };
    // }
}
