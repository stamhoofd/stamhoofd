import { XlsxTransformerColumn } from '@stamhoofd/excel-writer';
import { Address, CountryHelper, MemberWithRegistrationsBlob, Parent, ParentTypeHelper } from '@stamhoofd/structures';

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

    static creatColumnsForParents(): XlsxTransformerColumn<unknown>[] {
        return [
            ...this.createColumnsForParent(0),
            ...this.createColumnsForParent(1),
        ];
    }

    static createColumnsForAddresses<T>({ limit, getAddresses, matchIdStart, identifier }: { limit: number; getAddresses: (object: T) => Address[]; matchIdStart: string; identifier: string }): XlsxTransformerColumn<unknown>[] {
        const result: XlsxTransformerColumn<unknown>[] = [];

        for (let i = 0; i <= limit; i++) {
            const column = this.createAddressColumns({
                matchId: `${matchIdStart}.${i}`,
                getAddress: (object: T) => getAddresses(object)[i],
                identifier: `${identifier} ${i + 1}`,
            });

            result.push(column);
        }

        return result;
    }

    static createColumnsForParent(parentIndex: number): XlsxTransformerColumn<unknown>[] {
        const getParent = (member: MemberWithRegistrationsBlob): Parent | null | undefined => member.details.parents[parentIndex];

        const parentNumber = parentIndex + 1;

        const identifier = `Ouder ${parentNumber}`;
        const getId = (value: string) => `parent.${parentIndex}.${value}`;
        const getName = (value: string) => `${identifier} - ${value}`;

        return [
            {
                id: getId('type'),
                name: getName('Type'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => {
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
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member)?.firstName ?? '',
                }),
            },
            {
                id: getId('lastName'),
                name: getName('Achternaam'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member)?.lastName ?? '',
                }),
            },
            {
                id: getId('phone'),
                name: getName('Telefoonnummer'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member)?.phone ?? '',
                }),
            },
            {
                id: getId('email'),
                name: getName('E-mailadres'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member)?.email ?? '',
                }),
            },
            XlsxTransformerColumnHelper.createAddressColumns<MemberWithRegistrationsBlob>({
                matchId: getId('address'),
                getAddress: member => getParent(member)?.address,
                identifier: getName('Adres'),
            }),
        ];
    }

    static createAddressColumns<T>({ matchId, identifier, getAddress }: { matchId: string; identifier?: string; getAddress: (object: T) => Address | null | undefined }): XlsxTransformerColumn<T> {
        const getId = (value: string) => matchId + '.' + value;
        const identifierText = identifier ? `${identifier} - ` : '';
        const getName = (value: string) => {
            const name = `${identifierText}${value}`;
            return name[0].toUpperCase() + name.slice(1);
        };

        return {
            match: (id) => {
                if (id === matchId) {
                    return [
                        {
                            id: getId('street'),
                            name: getName(`Straat`),
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
                            name: getName('Nummer'),
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
                            name: getName('Postcode'),
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
                            name: getName('Stad'),
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
                            name: getName('Land'),
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
