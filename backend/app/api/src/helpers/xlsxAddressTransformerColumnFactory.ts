import { XlsxTransformerColumn } from '@stamhoofd/excel-writer';
import { Address, CountryHelper, Parent, ParentTypeHelper, PlatformMember } from '@stamhoofd/structures';

export class XlsxTransformerColumnHelper {
    static formatBoolean(value: boolean | undefined | null): string {
        if (value === true) {
            return 'Ja';
        }

        if (value === false) {
            return 'Nee';
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
                name: getName('Type'),
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
                name: getName('Voornaam'),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.firstName ?? '',
                }),
            },
            {
                id: getId('lastName'),
                name: getName('Achternaam'),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.lastName ?? '',
                }),
            },
            {
                id: getId('phone'),
                name: getName('Telefoonnummer'),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.phone ?? '',
                }),
            },
            {
                id: getId('email'),
                name: getName('E-mailadres'),
                width: 20,
                getValue: (member: PlatformMember) => ({
                    value: getParent(member)?.email ?? '',
                }),
            },
            {
                id: getId('nationalRegisterNumber'),
                name: getName('Rijksregisternummer'),
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
                            width: 30,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.street || '',
                                };
                            },
                        },
                        {
                            id: getId('number'),
                            name: 'Nummer',
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
                            name: 'Postcode',
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
                            name: 'Stad',
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
                            name: 'Land',
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
}
