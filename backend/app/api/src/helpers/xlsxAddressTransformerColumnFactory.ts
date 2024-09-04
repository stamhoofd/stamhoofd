import { XlsxTransformerColumn } from "@stamhoofd/excel-writer";
import { Address, CountryHelper, MemberWithRegistrationsBlob, Parent, ParentTypeHelper } from "@stamhoofd/structures";

export class XlsxTransformerColumnHelper {
    static creatColumnsForParents(): XlsxTransformerColumn<unknown>[] {
        return [
            ...this.createColumnsForParent(0),
            ...this.createColumnsForParent(1),
        ]
    }
    static createColumnsForParent(parentIndex: number): XlsxTransformerColumn<unknown>[] {
        const getParent = (member: MemberWithRegistrationsBlob): Parent => member.details.parents[parentIndex]; 

        const parentNumber = parentIndex + 1;

        const identifier = `Ouder ${parentNumber}`
        const getId = (value: string) => `parent.${parentIndex}.${value}`;
        const getName = (value: string) => `${identifier} - ${value}`

        return [
            {
                id: getId('type'),
                name: getName('Type'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: ParentTypeHelper.getName(getParent(member).type)
                })
            },
            {
                id: getId('firstName'),
                name: getName('Voornaam'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member).firstName
                })
            },
            {
                id: getId('lastName'),
                name: getName('Achternaam'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member).lastName
                })
            },
            {
                id: getId('phone'),
                name: getName('Telefoonnummer'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member).email
                })
            },
            {
                id: getId('email'),
                name: getName('E-mailadres'),
                width: 20,
                getValue: (member: MemberWithRegistrationsBlob) => ({
                    value: getParent(member).email
                })
            },
            XlsxTransformerColumnHelper.createAddressColumns<MemberWithRegistrationsBlob>({
                matchId: getId('address'),
                getAddress: (member) => getParent(member).address,
                identifier
            }),
        ]
    }

    static createAddressColumns<T>({matchId, identifier, getAddress} : {matchId: string, identifier?: string, getAddress: (object: T) => Address | null | undefined}): XlsxTransformerColumn<T> {
        const getId = (value: string) => matchId + '.' + value;
        const identifierText = identifier ? `${identifier} - ` : '';
        const getName = (value: string) => {
            const name =`${identifierText}adres - ${value}`;
            return name[0].toUpperCase() + name.slice(1);
        };
    
        return {
            match: (id) => {
                if(id === matchId) {
                    return [
                        {
                            id: getId('street'),
                            name: getName(`Straat`),
                            width: 30,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.street || ''
                                }
                            }
                        },
                        {
                            id: getId('number'),
                            name: getName('Nummer'),
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.number || ''
                                }
                            }
                        },
                        {
                            id: getId('postalCode'),
                            name: getName('Postcode'),
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.postalCode || ''
                                }
                            }
                        },
                        {
                            id: getId('city'),
                            name: getName('Stad'),
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                return {
                                    value: address?.city || ''
                                }
                            }
                        },
                        {
                            id: getId('country'),
                            name: getName('Land'),
                            width: 20,
                            getValue: (object: T) => {
                                const address = getAddress(object);
                                const country = address?.country;
                                return {
                                    value: country ? CountryHelper.getName(country) : ''
                                }
                            }
                        }
                    ]
                }
    
            }
        }
    
    }   
}
