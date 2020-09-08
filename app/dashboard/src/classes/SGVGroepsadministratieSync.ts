import { Gender, RecordType, Address, EmergencyContact, Parent, ParentType, MemberDetails } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/networking';
import { SGVLidMatch } from './SGVGroepsadministratie';
import { StringCompare, Formatter } from '@stamhoofd/utility';

export function getPatch(details: MemberDetails, lid: any): any {
    const newAddresses: any[] = []
    const newContacts: any[] = []

    let hasPostAdres = false

    const addressMap: Map<string, string> = new Map()

    // Create an address mapping
    if (details.address) {
        const a = createOrUpdateAddress(details.address, lid.adressen, 1)
        newAddresses.push(a)
        addressMap.set(details.address.toString(), a.id)

        if (!hasPostAdres) {
            // Users own address is always postadres
            a.postadres = true;
            hasPostAdres = true;
        }
    }

    for (const [index, parent] of details.parents.entries()) {
        if (parent.address && !addressMap.has(parent.address.toString())) {
            const a = createOrUpdateAddress(parent.address, lid.adressen, index + 1)
            newAddresses.push(a)
            addressMap.set(parent.address.toString(), a.id)

            if (hasPostAdres) {
                // Disable postadres
                a.postadres = false;
            } else {
                if (a.postadres) {
                    hasPostAdres = true;
                }
            }
        }

        newContacts.push(createOrUpdateParent(parent, lid.contacten, addressMap))
    }

    if (!hasPostAdres && newAddresses.length > 0) {
        newAddresses[0].postadres = true
    }

    // Construct the patch: compare and check the fields that need changes
    const patch: any = {
        persoonsgegevens: {
            geslacht: details.gender == Gender.Male ? "man" : (details.gender == Gender.Female ? "vrouw" : "andere"),
            gsm: details.phone ?? ""
        },
        vgagegevens: {
            voornaam: details.firstName,
            achternaam: details.lastName,
            beperking: lid.vgagegevens && lid.vgagegevens.beperking ? true : false,
            geboortedatum: Formatter.dateNumber(details.birthDay).split("/").reverse().join("-"),
            individueleSteekkaartdatumaangepast: lid.vgagegevens && lid.vgagegevens.individueleSteekkaartdatumaangepast ? lid.vgagegevens.individueleSteekkaartdatumaangepast : undefined,
            verminderdlidgeld: details.records.find(r => r.type == RecordType.FinancialProblems),
        },
        adressen: newAddresses,
        contacten: newContacts,
    }

    if (!lid.gebruikersnaam && details.email) {
        // Not possible to edit email if the user has a username set
        patch.email = details.email
    }


    return patch
}

// Versimpel een huisnummer bus combinatie voor vergelijkingen
// 1 A 3 R => 1A 3R
// A B 2 C => AB 2C
// AB 3 D => AB 3D
// 14/11 => 14 11
// 14 bus 11 => 14 11
// 14B => 14B
// 1B 3 45 => 1B 3 45
export function splitStreetNumber(huisnummer: string): {number: string, bus: string} {
    // Stap 1: verwijder alle speciale tekens
    const cleaned = huisnummer.toUpperCase().replace(/[^0-9A-Z]+/g, ' ')
    const parts = cleaned.split(' ')
    let str = ""

    // Was vorige letter een getal?
    let prev_ends_digit = false;

    for (let part of parts) {
        part = part.replace(/BUS/g, '')

        // Verwijder beginnende B's => sommige mensen gebruiken dit als BUS
        if (part[0] == "B") {
            part = part.substr(1)
        }

        // Verwijder beginnende nullen
        while (part.substr(0, 1) == "0") {
            part = part.substr(1)
        }

        const starts_digit = /\d+/.test(part.substr(0, 1));
        const ends_digit = /\d+/.test(part.substr(part.length - 1, 1));

        if (str == '' || (!starts_digit)) {
            // Als A 3 of 3 A
            // of A A
            // Aan elkaar schrijven
            
        } else {
            str += ' ';
        }

        str += part;
        prev_ends_digit = ends_digit;
    }

    // remove bus
    const split = str.split(" ")
    if (split.length > 1) {
        const b = split.pop()!
        return {
            number: split.join(" "),
            bus: b
        }
    }

    return {
        number: str,
        bus: ""
    }
}

function isSameAddress(address: Address, sgv: any) {
    if (StringCompare.typoCount(address.street, sgv.straat) != 0) {
        return false
    }

    if (StringCompare.typoCount(address.city, sgv.gemeente) != 0) {
        return false
    }

    if (StringCompare.typoCount(address.postalCode, sgv.postcode) != 0) {
        return false
    }

    const { number, bus } = splitStreetNumber(address.number)

    if (StringCompare.typoCount(number, sgv.nummer) != 0) {
        return false
    }

    if (StringCompare.typoCount(bus, sgv.bus ?? "") != 0) {
        return false
    }

    return true;
}


function isSameParent(parent: Parent, sgv: any) {
    if (StringCompare.typoCount(parent.firstName, sgv.voornaam) > 1) {
        return false
    }

    if (StringCompare.typoCount(parent.lastName, sgv.achternaam) > 1) {
        return false
    }

    return true;

}

function createOrUpdateAddress(address: Address, adressen: any, index: number): any {
    const existingAddress = adressen.find(a => isSameAddress(address, a))
    const updated = addressToSGV(address)

    if (existingAddress) {
        // Override fields
        const d = Object.assign({}, existingAddress, updated)
        if (existingAddress.postadres) {
            d.postadres = true
        }
        return d
    } else {
        updated.id = "tempadres"+index+""+new Date().getTime()
        return updated
    }
}

function addressToSGV(address: Address): any {
    const { number, bus } = splitStreetNumber(address.number)


    return {
        straat: address.street,
        bus,
        nummer: number,

        postcode: address.postalCode,
        gemeente: address.city,
        land: address.country,

        status: "normaal",
        showme: true,
        hasErrors: false,
        postadres: false,
        omschrijving: "",
    }
}


function parentToSGV(parent: Parent, adressen: Map<string, string>): any {
   
    return {
        voornaam: parent.firstName,
        achternaam: parent.lastName,
        adres: adressen.get(parent.address!.toString()),
        gsm: parent.phone ?? "",
        email: parent.email ?? "",
        rol: parent.type == ParentType.Father ? "vader" : (parent.type == ParentType.Mother ? "moeder" : "voogd"),
        showme: true,
    }
}

function createOrUpdateParent(parent: Parent, contacten: any, adressen: Map<string, string>): any {
    const existingContact = contacten.find(c => isSameParent(parent, c))
    const updated = parentToSGV(parent, adressen)

    if (existingContact) {
        // Override fields
        return Object.assign({}, existingContact, updated)
    } else {
        updated.id = (new Date().getTime())+""+Math.floor((Math.random()*100000))
        return updated
    }
}