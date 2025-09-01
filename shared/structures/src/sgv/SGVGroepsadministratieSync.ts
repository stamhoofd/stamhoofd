import { Formatter,StringCompare } from '@stamhoofd/utility';

import { Address } from '../addresses/Address';
import { Group } from '../Group';
import { Gender } from '../members/Gender';
import { MemberDetails } from '../members/MemberDetails';
import { MemberWithRegistrations } from '../members/MemberWithRegistrations';
import { Parent } from '../members/Parent';
import { ParentType } from '../members/ParentType';
import { ExternalSyncData } from '../OrganizationPrivateMetaData';
import { User } from '../User';
import { SGVLid } from './SGVStructures';

export type GroepFunctie = {
    id: string;
    beschrijving: string;
    code?: string|null;
}

export type LidFunctie = {
    functie: string; // id of groupFunctie
    einde?: string|null;
    begin?: string|null;
    groep: string;
}

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
    info: string[] = []

    unmanagedInStamhoofd: {member: MemberWithRegistrations, lid: any}[] = []
    unmanagedMissingInStamhoofd: any[] = []

    created: {member: MemberWithRegistrations, lid: any}[] = []
    synced: {member: MemberWithRegistrations, lid: any}[] = []
    deleted: SGVLid[] = []
    imported: MemberWithRegistrations[] = []
    skipped: MemberWithRegistrations[] = []

    addWarning(text: string) {
        this.warnings.push(text)
    }

    addInfo(text: string) {
        this.info.push(text)
    }

    addError(text: Error) {
        this.errors.push(text)
    }

    markCreated(member: MemberWithRegistrations, lid: any) {
        this.created.push({member, lid})
    }

    markSynced(member: MemberWithRegistrations, lid: any) {
        this.synced.push({member, lid})
    }

    markSkipped(member: MemberWithRegistrations) {
        this.skipped.push(member)
    }

    markImported(member: MemberWithRegistrations) {
        this.imported.push(member)
    }

    markDeleted(member: SGVLid) {
        this.deleted.push(member)
    }

    markUnmanaged(member: MemberWithRegistrations, lid: any) {
        this.unmanagedInStamhoofd.push({member, lid})
    }

    markUnmanagedMissing(lid: any) {
        this.unmanagedMissingInStamhoofd.push(lid)
    }

    createExternalSyncData(current: ExternalSyncData|null, user: User): ExternalSyncData|null {
        if (this.errors.length > 0) {
            return current;
        }

        const counts = new Map<string, number>();

        for (const item of [...this.created, ...this.synced]) {
            try {
                for (const functie of item.lid.functies) {
                    if (functie.einde) {
                        continue;
                    }

                    const code: string = functie.omschrijving || functie.code || 'Onbekende functie';
                    if (counts.has(code)) {
                        counts.set(code, counts.get(code)! + 1)
                    } else {
                        counts.set(code, 1)
                    }
                }
            } catch (e) {
                console.error('Report failed for item', item)
                console.error(e)
            }
        }

        for (const member of this.skipped) {
            try {
                const {patch: post} = getPatch(member, {
                    adressen: [],
                    contacten: [],
                    functies: []
                }, '1234', member.groups, getDefaultGroepFuncties())

                if (post.functies) {
                    for (const functie of post.functies) {
                        if (functie.einde) {
                            continue;
                        }

                        const functieId = functie.functie;
                        const f = getDefaultGroepFuncties().find(f => f.id === functieId)
                        if (f) {
                            const code = f?.beschrijving || f?.code || 'Onbekende functie';
                            
                            if (counts.has(code)) {
                                counts.set(code, counts.get(code)! + 1)
                            } else {
                                counts.set(code, 1)
                            }
                        }
                    }
                }
            } catch (e) {
                // ignore: member is not managed
            }
        }

        return ExternalSyncData.create({
            lastExternalSync: new Date(),
            lastDeleted: this.deleted.length > 0 ? new Date() : (current?.lastDeleted ?? null),
            lastSyncedBy: user.firstName ? (user.firstName + ' ' + user.lastName) : user.email,
            counts
        })
    }
}

export function isMemberManaged(member: MemberWithRegistrations) {
    try {
        const {patch: post} = getPatch(member, {
            adressen: [],
            contacten: [],
            functies: []
        }, '1234', member.groups, getDefaultGroepFuncties())

        if (post.functies.length > 0) {
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}

export function getLidName(lid: any) {
    return lid.vgagegevens.voornaam + ' ' + lid.vgagegevens.achternaam;
}

export function getLidBirthDay(lid: any) {
    if (!lid.vgagegevens || !lid.vgagegevens.geboortedatum) {
        return ''
    }
    return lid.vgagegevens.geboortedatum;
}

export function getLidFuncties(lid: any) {
    if (!lid.functies) {
        return ''
    }
    return lid.functies.filter(f => !f.einde).map(f => f.omschrijving || f.code || 'Onbekend').join(', ')
}


export function schrappen(lid: any, groepFuncties: GroepFunctie[]): any {
    const managedFuncties = getManagedFuncties(groepFuncties, true);

    const newFunctions: LidFunctie[] = []

    // Keep all functies that are not in managedFuncties or are ended
    for (const lidFunctie of (lid.functies ?? []) as LidFunctie[]) {
        // Keep all functies that have been ended
        if (lidFunctie.einde) {
            // Do not alter
            continue;
        }

        const id = lidFunctie.functie;
        const managedFunctie = managedFuncties.find(m => m.id === id)

        if (!managedFunctie) {
            // Not managed by Stamhoofd
            continue;
        }
        
        // SGV bug: throws error if you send links
        delete (lidFunctie as any).links;
        delete (lidFunctie as any).omschrijving;

        // End this function
        newFunctions.push({
            ...lidFunctie,
            einde: new Date().toISOString()
        });
    }

    // Construct the patch: compare and check the fields that need changes
    const patch: any = {
        functies: newFunctions
    }

    return patch
}

export function getPatch(member: MemberWithRegistrations, lid: any, groepNummer: string, groups: Group[], groepFuncties: GroepFunctie[], report?: SGVSyncReport, withHacks = false): {patch: any, needsMultiplePatches: boolean} {
    const details = member.details
    const newAddresses: any[] = []
    const newContacts: any[] = []

    let hasPostAdres = false
    const needsMultiplePatches = false;

    const addressMap: Map<string, string> = new Map()

    for (const [index, parent] of details.parents.entries()) {
        if (!parent.address) {
            throw new Error("Er ontbreekt een adres bij één van de ouders")
        }
        if (parent.address && !addressMap.has(parent.address.toString())) {
            const a = createOrUpdateAddress(parent.address, lid.adressen, index + 1, lid.contacten ?? [])
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

    // Create an address mapping
    if (details.address && !addressMap.has(details.address.toString())) {
        const a = createOrUpdateAddress(details.address, lid.adressen, 0, lid.contacten ?? [])
        newAddresses.push(a)
        addressMap.set(details.address.toString(), a.id)

        if (!hasPostAdres) {
            // Users own address is always postadres
            a.postadres = true;
            hasPostAdres = true;
        }
    }

    if (!hasPostAdres && newAddresses.length > 0) {
        // Prefer the address of one of the contacts if possible
        if (newContacts.length) {
            const id = newContacts[0].adres;
            const object = newAddresses.find(a => a.id === id)
            if (object) {
                object.postadres = true
                hasPostAdres = true
            }
        }

        // Just set the first address as postadres
        if (!hasPostAdres) {
            console.warn('No postadres found, setting the first address as postadres')
            newAddresses[0].postadres = true
        }
    }

    if (!details.birthDay) {
        throw new Error("Een geboortedatum is noodzakelijk voor de groepsadministratie")
    }

    const managedFuncties = getManagedFuncties(groepFuncties, true);
    const lidManagedFunctie = getFunctie(details, groups, groepFuncties);
    const stamhoofdFunctie = getStamhoofdFunctie(groepFuncties);
    let functieAlreadyPresent = false;
    let stamhoofdFunctieAlreadyPresent = false;

    const newFunctions: LidFunctie[] = []

    // Keep all functies that are not in managedFuncties or are ended
    for (const lidFunctie of (lid.functies ?? []) as LidFunctie[]) {
        // Keep all functies that have been ended
        if (lidFunctie.einde) {
            newFunctions.push(lidFunctie)
            continue;
        }

        const id = lidFunctie.functie;
        const managedFunctie = managedFuncties.find(m => m.id === id)

        if (!managedFunctie) {
            // Not managed by Stamhoofd
            newFunctions.push(lidFunctie)
            continue;
        }

        if (stamhoofdFunctie && id === stamhoofdFunctie.id) {
            // Already registered
            stamhoofdFunctieAlreadyPresent = true;
            newFunctions.push(lidFunctie)
            continue;
        }

        if (lidManagedFunctie && id === lidManagedFunctie.id) {
            // Already registered
            functieAlreadyPresent = true;
            newFunctions.push(lidFunctie)
            continue;
        }

        // SGV bug: throws error if you send links when creating or deleting
        delete (lidFunctie as any).links;
        delete (lidFunctie as any).omschrijving;

        // End this function
        newFunctions.push({
            ...lidFunctie,
            einde: new Date().toISOString()
        });
        report?.addInfo(details.name + ': functie verwijderd ' + managedFunctie.beschrijving)
    }

    if (!functieAlreadyPresent && lidManagedFunctie) {
        // Start
        newFunctions.push({
            groep: groepNummer,
            functie: lidManagedFunctie.id,
            begin: new Date().toISOString(),
        })
        report?.addInfo(details.name + ': functie toegekend ' + lidManagedFunctie.beschrijving)
    }

    if (!stamhoofdFunctieAlreadyPresent && stamhoofdFunctie) {
        // Start
        newFunctions.push({
            groep: groepNummer,
            functie: stamhoofdFunctie.id,
            begin: new Date().toISOString(),
        })
    }

    if (!lidManagedFunctie) {
        if (!stamhoofdFunctie && !lid.persoonsgegevens) {
            // Dit is een nieuw lid zonder functies
            throw new Error('We kunnen geen lid toevoegen zonder functie. Stamhoofd kan niet weten welke functies dit lid moet krijgen. Lees de documentatie na.')
        }
        // in groepsadmin, én in Stamhoofd, maar heeft geen functies
        report?.markUnmanaged(member, lid)
    }

    if (withHacks && lid.persoonsgegevens) {
        // Remove 'rijksregisternummeringevuld', 'lidtenlaste' fields from lid.persoonsgegevens
        delete lid.persoonsgegevens.rijksregisternummeringevuld;
        delete lid.persoonsgegevens.lidtenlaste;
    }
    

    // Construct the patch: compare and check the fields that need changes
    const patch: any = {
        persoonsgegevens: {
            ...(lid.persoonsgegevens ?? {}),
            geslacht: details.gender == Gender.Male ? "man" : (details.gender == Gender.Female ? "vrouw" : "andere"),
            gsm: details.phone ?? ""
        },
        vgagegevens: {
            // Maintain:
            verhoogdekinderbijslag:	false,
            beperking: false,
            ...(lid.vgagegevens ?? {}),

            // Override:
            voornaam: details.firstName,
            achternaam: details.lastName,
            geboortedatum: Formatter.dateNumber(details.birthDay).split("/").reverse().join("-"),
            verminderdlidgeld: details.requiresFinancialSupport?.value ?? false,
        }
    }

    if (!lid.adressen || !deepEqual(lid.adressen, newAddresses)) {
        // Skip updates
        patch.adressen = newAddresses
    }

    if (!lid.functies || !deepEqual(lid.functies, newFunctions)) {
        // Skip updates
        patch.functies = newFunctions
    }

    if (!lid.contacten || !deepEqual(lid.contacten, newContacts)) {
        // Skip updates
        patch.contacten = newContacts

        if (withHacks) {
            // Remove 'rijksregisternummeringevuld', 'lidtenlaste' fields from every contact
            for (const contact of patch.contacten) {
                delete contact.rijksregisternummeringevuld;
                delete contact.lidtenlaste;
            }
        }
    }

    const patchSections = lid.links && Array.isArray(lid.links) ? (lid?.links?.find(l => l.method === "PATCH")?.sections ?? []) : []

    if (patchSections.includes("email") && lid.email != details.email) {
        // Not possible to edit email if the user has a username set
        patch.email = details.email
    }
    
    return {
        patch,
        needsMultiplePatches
    }
}

export function isManaged(lid: any, groepFuncties: GroepFunctie[]): any {
    const managedFuncties = getManagedFuncties(groepFuncties, false);

    for (const lidFunctie of (lid.functies ?? []) as LidFunctie[]) {
        // Keep all functies that have been ended
        if (lidFunctie.einde) {
            continue;
        }

        const id = lidFunctie.functie;
        const managedFunctie = managedFuncties.find(m => m.id === id)

        if (managedFunctie) {
            return true;
        }
    }
    return false;
}

/**
 * Geeft een lijst van alle groepsadministratie functie ids die door Stamhoofd worden beheerd.
 */
export function getManagedFuncties(groepFuncties: GroepFunctie[], includeStamhoofdFunctie = true): GroepFunctie[] {
    const b = [...getGroepCodeMapping(groepFuncties).values()]

    if (includeStamhoofdFunctie) {
        const s = getStamhoofdFunctie(groepFuncties)
        if (s) {
            b.push(s)
        }
    }

    return b;
}

/**
 * Fix because API isn't returning all functies (probably a temporary bug in the API)
 */
export function getDefaultGroepFuncties(): GroepFunctie[] {
    return [
        {id: "d5f75b320b812440010b812555de03a2", beschrijving: "Kapoen", code: "KAP"},
        {id: "d5f75b320b812440010b8125567703cb", beschrijving: "Kabouter/Welp", code: "KW"},
        {id: "d5f75b320b812440010b812555d603a0", beschrijving: "Jonggids/Jongverkenner", code: "JGJV"},
        {id: "d5f75b320b812440010b8125565203c1", beschrijving: "Gids/Verkenner", code: "GVE"},
        {id: "d5f75b320b812440010b812554790354", beschrijving: "Akabelid", code: "AKAB"},
        {id: "d5f75b320b812440010b812555c1039b", beschrijving: "Jin", code: "JIN"},
    ]
}

/**
 * Mapt alle fucntie codes op een functie id van SGV
 */
export function getGroepCodeMapping(groepFuncties: GroepFunctie[]): Map<string, GroepFunctie> {
    const codes = [
        "KAP",
        "KW",
        "JGJV",
        "GVE",
        "AKAB",
        "JIN"
    ];

    const ids = new Map<string, GroepFunctie>();

    for (const code of codes) {
        for (const functie of groepFuncties) {
            if (functie.code === code) {
                ids.set(code, functie)
            }
        }

        if (!ids.has(code)) {
            throw new Error('Er ging iets fout. We konden geen functie in de groepsadministratie vinden voor ' + code)
        }
    }

    return ids;
}

const StamhoofdFunctieNaam = 'Beheerd in Stamhoofd'

/**
 * De groepseigenfunctie die Stamhoofd gebruikt om leden te markeren als 'beheerd in Stamhoofd' en toe tevoegen zonder functies
 */
export function getStamhoofdFunctie(groepFuncties: GroepFunctie[]): GroepFunctie|null {
    return groepFuncties.find(f => f.beschrijving === StamhoofdFunctieNaam) ?? null;
}

/**
 * De groepseigenfunctie die Stamhoofd gebruikt om leden te markeren als 'beheerd in Stamhoofd' en toe tevoegen zonder functies
 */
export function createStamhoofdFunctie(groepsnummer: string): GroepFunctie {
    return {
        beschrijving: StamhoofdFunctieNaam,
        groepen: [
            groepsnummer
        ],
        id: 'tempFunctie' + new Date().getTime()
    } as GroepFunctie
}

/**
 * Geeft de functie die dit lid moet krijgen in de groepsadministratie
 */
export function getFunctie(details: MemberDetails, memberGroups: Group[], groepFuncties: GroepFunctie[]): GroepFunctie|null {
    const mapping = getGroepCodeMapping(groepFuncties);

    // If the member is registered in one of these, and only one of these: use the provided code
    const allowedExactMatches: Record<string, string[]> = {
        "KAP": ["kapoenen"],
        "KW": ["kabouters", "welpen", "wouters"],
        "JGJV": ["jonggidsen", "jongverkenners", "jonggivers", "jong-verkenners", "jong-givers", "jong-gidsen"],
        "GVE": ["gidsen", "verkenners", "givers"],
        "AKAB": ["akabe"],
        "JIN": ["jin", "jins"]
    }
    
    const matches = new Set<string>()
    for (const code of Object.keys(allowedExactMatches)) {
        const words = allowedExactMatches[code];
        for (const word of words) {
            for (const group of memberGroups) {
                const name = group.settings.name;

                // Remove text between brackets, and sluggify the name
                const removedBrackets = name.replace(/\(.*?\)/g, '');
                const removedNumbers = removedBrackets.replace(/\d+/g, '');
                const slug = Formatter.slug(removedNumbers)
                if (StringCompare.typoCount(word, slug) == 0) {
                    matches.add(code);
                }
            }
        }
    }

    if (matches.size === 1) {
        // More than 1 -> not clear so use age
        // Exactly one -> very clear
        return mapping.get([...matches.values()][0])!
    }

    // Check age
    const ageMapping = [
        {code: "KAP", minAge: 5, maxAge: 7},
        {code: "KW",minAge: 8, maxAge: 10},
        {code: "JGJV",minAge: 11, maxAge: 13},
        {code: "GVE",minAge: 14, maxAge: 16},
        {code: "JIN",minAge: 17, maxAge: 17},
    ];

    // Bepaal het huidige scoutsjaar (einde 31 augustus)
    let year = new Date().getFullYear()
    const month = new Date().getMonth() + 1

    if (month <= 8) {
        // Still in last year
        year -= 1;
    }

    const age = details.ageForYear(year);
    if (!age) {
        throw new Error('Dit lid heeft geen geboortedatum ingesteld. Vul dit eerst aan.')
    }

    for (const map of ageMapping) {
        if (age >= map.minAge && age <= map.maxAge) {
            return mapping.get(map.code)!
        }
    }

    // Not managed by Stamhoofd
    return null;
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

function createOrUpdateAddress(address: Address, adressen: any, index: number, contacten?: any): any {
    const existingAddresses = adressen.filter(a => isSameAddress(address, a))
    let existingAddress = existingAddresses.length > 0 ? existingAddresses[0] : null

    // This is a fix for duplicate addresses, to avoid a loop as a result of the postadres issue
    if (existingAddresses.length > 1 && contacten && Array.isArray(contacten) && contacten.length > 0) {
        // Prefer one that was previously used by a contact
        const hasWithSameIdAsBefore = existingAddresses.find(a => contacten.find(c => c.adres === a.id))
        if (hasWithSameIdAsBefore) {
            existingAddress = hasWithSameIdAsBefore
        }
    }

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
        delete existingContact.rijksregisternummeringevuld;
        return Object.assign({}, existingContact, updated)
    } else {
        updated.id = (new Date().getTime())+""+Math.floor((Math.random()*100000))
        return updated
    }
}