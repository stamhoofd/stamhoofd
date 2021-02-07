import { SimpleError } from '@simonbackx/simple-errors';
import { Address, Gender, Group, MemberDetails, MemberWithRegistrations,Parent, ParentType, RecordType } from '@stamhoofd/structures';
import { Formatter,StringCompare } from '@stamhoofd/utility';

import { SGVLid } from './SGVGroepsadministratie';

function deepEqual(x, y) {
  if (x === y) {
    return true;
  }
  else if ((typeof x == "object" && x != null) && (typeof y == "object" && y != null)) {
    if (Object.keys(x).length != Object.keys(y).length)
      return false;

    for (const prop in x) {
      if (y.hasOwnProperty(prop))
      {  
        if (! deepEqual(x[prop], y[prop]))
          return false;
      }
      else
        return false;
    }

    return true;
  }
  else 
    return false;
}

function trim(t: string) {
    return t.replace(/^[^a-zA-Z0-9]/, "").replace(/[^a-zA-Z0-9]$/, "")
}

export class SGVSyncReport {
    warnings: string[] = []
    errors: Error[] = []

    created: MemberWithRegistrations[] = []
    synced: MemberWithRegistrations[] = []
    deleted: SGVLid[] = []
    imported: MemberWithRegistrations[] = []

    addWarning(text: string) {
        this.warnings.push(text)
    }

    addError(text: Error) {
        this.errors.push(text)
    }

    markCreated(member: MemberWithRegistrations) {
        this.created.push(member)
    }

    markSynced(member: MemberWithRegistrations) {
        this.synced.push(member)
    }

    markImported(member: MemberWithRegistrations) {
        this.imported.push(member)
    }

    markDeleted(member: SGVLid) {
        this.deleted.push(member)
    }
}

export function schrappen(lid: any, allGroups: Group[], groepFuncties: any): any {
    const newFuncties: any[] = []
    const mapping = buildGroupMapping(allGroups, groepFuncties)

    for (const functie of lid.functies ?? []) {
        // Keep all functies that have been ended
        if (functie.einde) {
            newFuncties.push(functie)
            continue;
        } 

        // Keep all functies that are not managed by Stamhoofd
        const info = groepFuncties.find(f => f.id == functie.functie)
        if (!info) {
            // Keep.
            console.warn("Unknown functie "+functie.functie)
            newFuncties.push(functie)
            continue
        }

        if (mapping.has(functie.functie)) {
            // Managed by stamhoofd
            // => end this
            functie.einde = Formatter.dateIso(new Date())
            newFuncties.push(functie)
        } else {
            newFuncties.push(functie)
            continue
        }

    }

    // Construct the patch: compare and check the fields that need changes
    const patch: any = {
        functies: newFuncties
    }

    return patch
}

export function getPatch(details: MemberDetails, lid: any, groepNummer: string, groups: Group[], allGroups: Group[], groepFuncties: any, report?: SGVSyncReport): any {
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
        if (!parent.address) {
            throw new Error("Er ontbreekt een adres bij één van de ouders")
        }
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

    let hasActiveFunctie = false // True als we een active functie hebben (zonder einde)
    const mapping = buildGroupMapping(allGroups, groepFuncties)
    const remainingFuncties: any[] = []

    // Due to some bugs in the SGV API it is essential that we keep the same order
    // as the one we received from the api
    // Deep clone

    const newFuncties = JSON.parse(JSON.stringify(lid.functies ?? []))

    // Find a match in groepsadmin
    for (const [functieId, _groeps] of mapping) {
        // Loop all the groups in Stamhoofd that ar connected to a given function ID in SGV

        const functie =  groepFuncties.find(f => f.id == functieId)
        if (!functie) {
            // Keep.
            hasActiveFunctie = true
            continue
        }

        // Should this member get registered in this functie?
        let found = false
        for (const groep of groups) {
            for (const _groep of _groeps) {
                if (groep.id == _groep.id) {                   
                    found = true
                    break
                }
            }
            if (found) {
                break
            }
        }

        if (!found) {
            // No, end all functies with this id
            for (const f of newFuncties) {
                if (!f.einde && f.functie == functie.id) {
                    f.einde = Formatter.dateIso(new Date())
                }
            }
        } else {
            // Register or keep register.
            hasActiveFunctie = true

            // This member should be in this group.
            const currentFunctie = newFuncties.find(f => f.functie == functie.id && !f.einde)
            if (currentFunctie) {
                // Already in this group
                continue;
            }

            // Add.
            newFuncties.push({
                groep: groepNummer,
                functie: functie.id,
                begin: Formatter.dateIso(new Date()),
            })
        }
    }

    if (!hasActiveFunctie) {
        // todo: mark somehow...
        report?.addWarning(details.firstName+" "+details.lastName+" moet nog een functie toegekend krijgen in de groepsadministratie, we konden niet automatisch bepalen welke functies we moeten toekennen.")
    }

    if (!details.birthDay) {
        throw new Error("Een geboortedatum is noodzakelijk voor de groepsadministratie")
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
            verminderdlidgeld: details.records.find(r => r.type == RecordType.FinancialProblems) ? true : false,
        }
    }

    if (!lid.adressen || !deepEqual(lid.adressen, newAddresses)) {
        // Skip updates
        patch.adressen = newAddresses
    }

    if (!lid.functies || !deepEqual(lid.functies, newFuncties)) {
        // Skip updates
        patch.functies = newFuncties
    }

    if (!lid.contacten || !deepEqual(lid.contacten, newContacts)) {
        // Skip updates
        patch.contacten = newContacts
    }

    if (!lid.gebruikersnaam && details.email) {
        // Not possible to edit email if the user has a username set
        patch.email = details.email
    }


    return patch
}

/**
 * Returns a list of groepsadmin ids => groups that Stamhoofd will handle for this group
 */
export function buildGroupMapping(groups: Group[], groepFuncties: any): Map<string, Group[]> {
    const mapping = {
        "KAP": ["kapoenen"],
        "KW": ["kabouters", "welpen", "wouters", "woudlopers", "kawellen", "wolven"],
        "JGJV": ["jonggidsen", "jongverkenners", "jonggivers"],
        "GVE": ["gidsen", "verkenners", "givers"],
        "AKAB": ["akabe"],
        "JIN": ["jin"]
    }

    const defaultAgeMapping = [
        {code: "KAP", minAge: 6, maxAge: 7},
        {code: "KW",minAge: 8, maxAge: 10},
        {code: "JGJV",minAge: 11, maxAge: 13},
        {code: "GVE",minAge: 14, maxAge: 16},
        {code: "JIN",minAge: 17, maxAge: 17},
    ]
    const looseMatches = [
        ["woudloper", "woudlopers"],
        ["los lid", "losse leden"]
    ]
    const map = new Map<string, Group[]>()
    main: for (const groep of groups) {

        // Find exact name matches
        for (const functie of groepFuncties) {
            // Als naam exact overeenkomt in de groepsadministratie => we nemen deze over
            if (StringCompare.typoCount(functie.beschrijving, groep.settings.name) == 0) {
                map.set(functie.id, [...(map.get(functie.id) ?? []), groep])

                // We blijven doorlopen, want sommige takken moeten matchen op meerdere functies (bv. wolven kan matchen op groepseigen wolven + welpen van SGV)
                //continue main;
                break;
            }
        }

        // Als we een loose map ondersteunen
        loose: for (const matchgroup of looseMatches) {
            for (const groupName of matchgroup) {
                if (StringCompare.typoCount(groupName, groep.settings.name) == 0) {
                    // we got a match group

                    for (const functie of groepFuncties) {
                        for (const groupName2 of matchgroup) {
                            // Als naam exact overeenkomt in de groepsadministratie => we nemen deze over
                            if (StringCompare.typoCount(functie.beschrijving, groupName2) == 0) {

                                const current = map.get(functie.id) ?? []
                                if (!current.find(g => g.id == groep.id)) {
                                    map.set(functie.id, [...current, groep])
                                }
                                //continue main;
                                break loose;
                            }
                        }
                    }
                }
            }
        }

        // Find a match in groepsadmin
        for (const code in mapping) {
            if (Object.prototype.hasOwnProperty.call(mapping, code)) {
                const names = mapping[code];

                for (const name of names) {
                    if (StringCompare.typoCount(groep.settings.name, name) == 0) {
                        const functie =  groepFuncties.find(f => f.code == code)
                        if (!functie) {
                            throw new Error(code+" niet gevonden :(")
                        }

                        const current = map.get(functie.id) ?? []
                        if (!current.find(g => g.id == groep.id)) {
                            map.set(functie.id, [...current, groep])
                        }
                        continue main;
                    }
                }
            }
        }
        // And also add based on age if we didn't find a match in groepsadmin
        if (groep.settings.minAge && groep.settings.minAge <= 18 && groep.settings.maxAge && groep.settings.maxAge <= 18) {
            // find a match for normal members

            for (const age of defaultAgeMapping) {
                if (groep.settings.minAge >= age.minAge && groep.settings.minAge <= age.maxAge) {
                    // Found one
                    const functie =  groepFuncties.find(f => f.code == age.code)
                    if (!functie) {
                        throw new Error( age.code+" niet gevonden :(")
                    }

                    const current = map.get(functie.id) ?? []
                    if (!current.find(g => g.id == groep.id)) {
                        map.set(functie.id, [...current, groep])
                    }
                    continue main;
                }
            }

        }
    }


    return map
}

// Versimpel een huisnummer bus combinatie voor vergelijkingen
// 1 A 3 R => 1A 3R
// A B 2 C => AB 2C
// AB 3 D => AB 3D
// 14/11 => 14 11
// 14 bus 11 => 14 11
// 14B => 14B
// 1B 3 45 => 1B 3 45
export function splitStreetNumber(huisnummer: string): {number: string; bus: string} {
    // Stap 1: verwijder alle speciale tekens
    const cleaned = huisnummer.toUpperCase().replace(/[^0-9A-Z]+/g, ' ')
    const parts = cleaned.split(' ')
    let str = ""

    // Was vorige letter een getal?
    let prev_ends_digit = false;

    for (let part of parts) {
        part = part.replace(/BUS/g, '')

        // Verwijder beginnende B's => sommige mensen gebruiken dit als BUS
        if (part.startsWith("B")) {
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
    if (StringCompare.typoCount(trim(address.street), trim(sgv.straat)) != 0) {
        return false
    }

    if (StringCompare.typoCount(trim(address.city), trim(sgv.gemeente)) != 0) {
        return false
    }

    if (StringCompare.typoCount(trim(address.postalCode), trim(sgv.postcode)) != 0) {
        return false
    }

    const { number, bus } = splitStreetNumber(address.number)

    if (StringCompare.typoCount(trim(number), trim(sgv.nummer)) != 0) {
        return false
    }

    if (StringCompare.typoCount(trim(bus), trim(sgv.bus ?? "")) != 0) {
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
        straat: trim(address.street),
        bus: trim(bus),
        nummer: trim(number),

        postcode: trim(address.postalCode),
        gemeente: trim(address.city),
        land: address.country,

        status: "normaal",
        postadres: false,
        omschrijving: "",
        telefoon: "",
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