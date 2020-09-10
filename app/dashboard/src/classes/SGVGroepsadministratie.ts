import { Toast } from '@stamhoofd/components';
import { Server, Request, RequestMiddleware, RequestResult } from '@simonbackx/simple-networking';
import { ObjectData, DateDecoder, AutoEncoder, field, IntegerDecoder, ArrayDecoder, Decoder, StringDecoder, BooleanDecoder, Data } from '@simonbackx/simple-encoding';
import { Gender, Country, CountryDecoder, Organization, MemberWithRegistrations, RecordType } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/networking';
import { Formatter, StringCompare } from '@stamhoofd/utility';
import { OrganizationManager } from './OrganizationManager';
import { SimpleError, SimpleErrors, isSimpleErrors } from '@simonbackx/simple-errors';
import { MemberManager } from './MemberManager';
import { NavigationMixin, ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import SGVVerifyProbablyEqualView from '../views/dashboard/scouts-en-gidsen/SGVVerifyProbablyEqualView.vue';
import SGVOldMembersView from '../views/dashboard/scouts-en-gidsen/SGVOldMembersView.vue';
import SGVReportView from '../views/dashboard/scouts-en-gidsen/SGVReportView.vue';
import { getPatch, SGVSyncReport, buildGroupMapping } from './SGVGroepsadministratieSync';
import { LinkedErrors } from '@sentry/browser/dist/integrations';

export class SGVFoutDecoder implements Decoder<SimpleError> {

    decode(data: ObjectData): SimpleError {
        const message = data.field("beschrijving").string
        const field = data.optionalField("veld")?.string
        return new SimpleError({
            code: "SGVError",
            message,
            field,
        })
        
    }
    
}

export class SGVFoutenDecoder implements Decoder<SimpleErrors> {
    decode(data: ObjectData): SimpleErrors {
        // Support multiple random error formats
        const fouten = data.optionalField("fouten")
        if (fouten) {
            const arr = fouten.array(new SGVFoutDecoder())
            if (arr.length > 0) {
                return new SimpleErrors(...arr)
            }
        }

        const msg = data.optionalField("msg")?.string

        if (msg) {
            return new SimpleErrors(new SimpleError({
                code: "SGVError",
                message: msg
            }))
        }

        const titel = data.field("titel").string
        const beschrijving = data.optionalField("beschrijving")?.string
        return new SimpleErrors(new SimpleError({
            code: "SGVError",
            message: titel + (beschrijving ? (": " + beschrijving) : "")
        }))
    }
}

export class SGVMemberError extends Error {
    member: MemberWithRegistrations | SGVLid
    error: Error

    constructor(member: MemberWithRegistrations | SGVLid, error: Error) {
        super(error.message);
        this.member = member
        this.error = error
    }
}

export interface SGVLidMatch {
    stamhoofd: MemberWithRegistrations
    sgvId: string
}

export interface SGVLidMatchVerify {
    stamhoofd: MemberWithRegistrations
    sgv: SGVLid
    verify: boolean
}

export class SGVLid {
    id: string;
    firstName: string;
    lastName: string;
    lidNummer: string;
    gender: Gender;
    birthDay: Date;

    constructor(object: {
        id: string;
        firstName: string;
        lastName: string;
        lidNummer: string;
        gender: Gender;
        birthDay: Date;
    }) {
        this.id = object.id
        this.firstName = object.firstName
        this.lastName = object.lastName
        this.birthDay = object.birthDay

        this.lidNummer = object.lidNummer
        this.gender = object.gender
    }

    static decode(data: ObjectData) {
        const g = data.field("waarden").field("be.vvksm.groepsadmin.model.column.GeslachtColumn").string
        const date = data.field("waarden").field("be.vvksm.groepsadmin.model.column.GeboorteDatumColumn").string
        
        const splitted = date.split("/")
        if (splitted.length != 3) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Expected DD/MM/YYYY formatted string",
                field: data.addToCurrentField("waarden.be.vvksm.groepsadmin.model.column.GeboorteDatumColumn")
            })
        }

        const year = parseInt(splitted[2])
        const month = parseInt(splitted[1])
        const day = parseInt(splitted[0])

         if (isNaN(year) || isNaN(month) || isNaN(day) || day > 31 || month > 12 || year > 2200 || year < 1900) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Expected DD/MM/YYYY formatted string",
                field: data.addToCurrentField("waarden.be.vvksm.groepsadmin.model.column.GeboorteDatumColumn")
            })
        }

        return new SGVLid({
            id: data.field("id").string,
            firstName: data.field("waarden").field("be.vvksm.groepsadmin.model.column.VoornaamColumn").string,
            lastName: data.field("waarden").field("be.vvksm.groepsadmin.model.column.AchternaamColumn").string,
            birthDay: new Date(year, month-1, day, 12),
            lidNummer: data.field("waarden").field("be.vvksm.groepsadmin.model.column.LidNummerColumn").string,
            gender: g == "V" ? Gender.Female : (g == "M" ? Gender.Male : Gender.Other),
        })
    }

    isEqual(member: MemberWithRegistrations) {
        return StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName) == 0 && StringCompare.typoCount(Formatter.dateNumber(member.details!.birthDay), Formatter.dateNumber(this.birthDay)) == 0 
    }

    isProbablyEqual(member: MemberWithRegistrations) {
        const t = StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName)
        const y = StringCompare.typoCount(Formatter.dateNumber(member.details!.birthDay), Formatter.dateNumber(this.birthDay))

        if (t + y <= 3 && y <= 1 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details!.firstName.length+member.details!.lastName.length)) {
            return true;
        }
        return false;
    }

    isProbablyEqualLastResort(member: MemberWithRegistrations) {
        const t = StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName)

        if (t <= 2 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details!.firstName.length+member.details!.lastName.length)) {
            return true;
        }
        return false;
    }
}


export class SGVZoekLid extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder, field: "voornaam" })
    firstName: string;

    @field({ decoder: StringDecoder, field: "achternaam" })
    lastName: string;

    isEqual(member: MemberWithRegistrations) {
        return StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName) == 0
    }

    isProbablyEqual(member: MemberWithRegistrations) {
        const t = StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.firstName+" "+this.lastName)

        if (t <= 2 && t < 0.4*Math.min(this.firstName.length + this.lastName.length, member.details!.firstName.length+member.details!.lastName.length)) {
            return true;
        }
        return false;
    }
}

class SGVZoekenResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SGVZoekLid) })
    leden: SGVZoekLid[];
}

class SGVLedenResponse extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    aantal: number;

    @field({ decoder: IntegerDecoder })
    offset: number;

    @field({ decoder: IntegerDecoder })
    totaal: number;

    @field({ decoder: new ArrayDecoder(SGVLid) })
    leden: SGVLid[];
}

class SGVAdres extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: CountryDecoder })
    land: Country;

    @field({ decoder: StringDecoder })
    postcode: string;

    @field({ decoder: StringDecoder })
    gemeente: string;

    @field({ decoder: StringDecoder })
    straat: string;

    @field({ decoder: StringDecoder })
    nummer: string;

    @field({ decoder: StringDecoder })
    telefoon: string;

    @field({ decoder: BooleanDecoder })
    postadres: boolean;
}

class SGVGroep extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    groepsnummer: string;

    @field({ decoder: StringDecoder })
    naam: string;

    @field({ decoder: new ArrayDecoder(SGVAdres) })
    adressen: SGVAdres[];
}


class SGVGroepResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SGVGroep) })
    groepen: SGVGroep[];
}


class SGVFunctie extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    beschrijving: string;

    @field({ decoder: StringDecoder })
    type: string;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    groepen: string[];

    @field({ decoder: StringDecoder, optional: true })
    code?: string;
}


class SGVGFunctieResponse extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(SGVFunctie) })
    functies: SGVFunctie[];
}

class SGVGroepsadministratieStatic implements RequestMiddleware {
    token: {accessToken: string; refreshToken: string} | null = null // null to keep reactive
    clientId = "groep-O2209G-Prins-Boudewijn-Wetteren"
    redirectUri = "https://stamhoofd.app/oauth/sgv"
    dryRun = false
    
    /**
     * List of all members (pretty low in memory because we don't save a lot of data)
     */
    leden: SGVLid[] = []
    groupNumber: string | null = null
    group: SGVGroep | null = null
    functies: SGVFunctie[] = []

    get hasToken() {
        return !!this.token
    }

    /**
     * Redirect to the OAuth flow to get a new token
     */
    startOAuth() {
        const state = new Buffer(crypto.getRandomValues(new Uint32Array(16))).toString('base64');

        // Save state here

        // https://login.scoutsengidsenvlaanderen.be/auth/realms/scouts/.well-known/openid-configuration

        const url = "https://login.scoutsengidsenvlaanderen.be/auth/realms/scouts/protocol/openid-connect/auth?client_id="+encodeURIComponent(this.clientId)+"&redirect_uri="+this.redirectUri+"&state="+state+"&response_mode=query&response_type=code&scope=openid"
        window.location.href = url;
    }

     async getToken(code: string) {
        const toast = new Toast("Inloggen...", "spinner").setWithOffset().setHide(null).show()

        try {
            const response: RequestResult<any> = await this.loginServer.request({
                method: "POST",
                path: "/auth/realms/scouts/protocol/openid-connect/token",
                body: {
                    client_id: this.clientId,
                    code: code,
                    grant_type: "authorization_code",
                    redirect_uri: this.redirectUri
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            })

            console.log(response)

            this.token = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token
            };

            // Maybe: redirect_uri
            toast.hide()
            new Toast("Ingelogd bij groepsadministratie", "success green").setWithOffset().show()
        } catch (e) {
            console.error(e)
            toast.hide()
            new Toast("Inloggen mislukt", "error red").setWithOffset().show()
        }
    }

    async setGroupIfNeeded() {
        if (!this.groupNumber) {
            const group = await this.getGroup()
            if (!group) {
                throw new SimpleError({
                    code: "",
                    message: "We konden jouw scoutsgroep niet vinden in dit groepsadministratie account. Controleer het adres en de naam die je in Stamhoofd hebt ingesteld en zorg dat deze overeen komt met de naam in de groepsadministratie."
                })
            }
            console.log(group)
            this.group = group
            this.groupNumber = group.groepsnummer
        }
    }

    // Search the group
    async getGroup(): Promise<SGVGroep | null> {
        const response = await this.workAroundAuthenticatedServer.request({
            method: "GET",
            path: "/groep",
            decoder: SGVGroepResponse as Decoder<SGVGroepResponse>
        })
        console.log(response)

        const organization = OrganizationManager.organization

        // Search for the group
        for (const group of response.data.groepen) {
            if (Formatter.slug(group.naam) == Formatter.slug(organization.name)) {
                return group
            }
            for (const adres of group.adressen) {
                if (Formatter.slug(adres.straat) == Formatter.slug(organization.address.street) && Formatter.slug(adres.postcode) == Formatter.slug(organization.address.postalCode)) {
                    return group;
                }
            }
        }
        return null
    }

    async getFuncties() {
        const response = await this.workAroundAuthenticatedServer.request({
            method: "GET",
            path: "/functie",
            query: {
                groep: this.groupNumber
            },
            decoder: SGVGFunctieResponse as Decoder<SGVGFunctieResponse>
        })
        console.log(response)
        this.functies = response.data.functies
        console.log(this.functies)
    }

    async checkFuncties() {
        await this.getFuncties()

        // Check if this user has access to all the needed groups...
        if (!this.functies.find(f => f.code == 'VGA' || f.code == 'GRL')) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Synchroniseren met de groepsadministratie is voorlopig enkel beschikbaar voor groepsleiding of voor de verantwoordelijke van de groepsadministratie (VGA)"
            })
        }
    }

    async setManagedFilter() {
        // alleen leden met functies downloaden waarvoor Stamhoofd verantwoordelijk is
        const mapping = buildGroupMapping(OrganizationManager.organization.groups, this.functies)
        
        await this.workAroundAuthenticatedServer.request({
            method: "PATCH",
            path: "/ledenlijst/filter/huidige",
            body: {
                "criteria":{
                    "functies": Array.from(mapping.keys()),
                    "groepen": [this.groupNumber ],
                    "oudleden": false,
                },
                "kolommen":[
                    "be.vvksm.groepsadmin.model.column.LidNummerColumn",
                    "be.vvksm.groepsadmin.model.column.VoornaamColumn",
                    "be.vvksm.groepsadmin.model.column.AchternaamColumn",
                    "be.vvksm.groepsadmin.model.column.GeboorteDatumColumn",
                    "be.vvksm.groepsadmin.model.column.GeslachtColumn"
                ],
                "groepen":[],
                "sortering":["be.vvksm.groepsadmin.model.column.LidNummerColumn"],
                "type":"lid",
            }
        })
    }

    /**
     * Voor we een lid als 'nieuw' beschouwen moeten we echt zeker zijn
     */
    async zoekGelijkaardig(member: MemberWithRegistrations): Promise<SGVZoekLid | undefined> {
        const response = await this.workAroundAuthenticatedServer.request({
            method: "GET",
            path: "/zoeken/gelijkaardig",
            query: {
                voornaam: member.details!.firstName,
                achternaam: member.details!.lastName,
            },
            decoder: SGVZoekenResponse as Decoder<SGVZoekenResponse>
        })
        if (response.data.leden.length > 0) {
            for (const lid of response.data.leden) {
                if (lid.isEqual(member)) {
                    return lid
                }
            }

            for (const lid of response.data.leden) {
                if (lid.isProbablyEqual(member)) {
                    return lid
                }
            }
        }
    }

    async downloadAll() {
        await this.setGroupIfNeeded();
        await this.checkFuncties()
        await this.setManagedFilter()

        try {
            this.leden = await this.downloadWithCurrentFilter()
            console.log(this.leden)
        } catch (e) {
            console.error(e)
            new Toast("Leden ophalen mislukt", "error red").show()
        }
    }

    async downloadWithCurrentFilter() {
        const leden: SGVLid[] = []
        try {
            let offset = 0
            let total = 1

            while (offset < total) {
                // prevent brute force attack, spread the load
                await sleep(250);
                const response = await this.authenticatedServer.request({
                    method: "GET",
                    path: "/ledenlijst",
                    query: {
                        aantal: 100,
                        offset: offset
                    },
                    decoder: SGVLedenResponse as Decoder<SGVLedenResponse>
                })
                console.log(response)

                leden.push(...response.data.leden)

                // Set new offset
                offset = response.data.offset + response.data.aantal
                total = response.data.totaal
            }
        } catch (e) {
            throw e;
        }
        return leden;
    }

    async matchAndSync(component: NavigationMixin, onPopup: () => void): Promise<{ matchedMembers, newMembers }> {
        // Members that are missing in groepsadmin
        let newMembers: MemberWithRegistrations[] = []

        const matchedMembers: SGVLidMatch[] = []

        // Start! :D
        const allMembers = await MemberManager.loadMembers(null, false)

        for (const member of allMembers) {
            if (!member.details) {
                throw new SimpleError({
                    code: "",
                    message: "We konden niet synchroniseren omdat de gegevens van "+member.firstName+" ontbreken (achternaam ontbreekt ook). Vul dit lid eerst verder aan in Stamhoofd."
                })
            }
            const sgvMember = this.leden.find((sgvLid) => {
                return sgvLid.isEqual(member)
            })

            if (sgvMember) {
                matchedMembers.push({
                    stamhoofd: member,
                    sgvId: sgvMember.id
                })

            } else {
                console.log("Lid niet gevonden, zoeken in groepsadmin...")
                const gelijkaardig = await this.zoekGelijkaardig(member)
                if (gelijkaardig) {
                    console.log("Gevonden!")
                    matchedMembers.push({
                        stamhoofd: member,
                        sgvId: gelijkaardig.id
                    })
                } else {
                    console.log("Is echt een nieuw lid!")
                    newMembers.push(member)
                }
                await sleep(250)
            }
        }

        const probablyEqualList: SGVLidMatchVerify[] = []

        newMembers = newMembers.filter((member) => {
            const sgvMember = this.leden.find((sgvLid) => {
                return sgvLid.isProbablyEqual(member)
            }) ?? this.leden.find((sgvLid) => {
                return sgvLid.isProbablyEqualLastResort(member)
            })
            if (sgvMember) {
                probablyEqualList.push({
                    stamhoofd: member,
                    sgv: sgvMember,
                    verify: true
                })
                return false
            }
            return true;
        })

        console.log("matched members:")
        console.log(matchedMembers)

        console.log("newMembers:")
        console.log(newMembers)

        console.log("Manual verify probably equal list:")
        console.log(probablyEqualList)

        if (probablyEqualList.length > 0) {
            return new Promise((resolve, reject) => {
                onPopup()
                component.present(new ComponentWithProperties(SGVVerifyProbablyEqualView, {
                    matches: probablyEqualList,
                    onCancel: () => {
                        reject(new SimpleError({
                            code: "",
                            message: "Synchronisatie geannuleerd"
                        }))
                    },
                    onVerified: async (verified: SGVLidMatchVerify[]) => {
                        try {
                            for (const member of verified) {
                                if (member.verify) {
                                    matchedMembers.push({
                                        stamhoofd: member.stamhoofd,
                                        sgvId: member.sgv.id
                                    })
                                } else {
                                    newMembers.push(member.stamhoofd)
                                }
                            }
                            resolve({ matchedMembers, newMembers })
                        } catch (e) {
                            reject(e)
                        }
                    }   
                }).setDisplayStyle("popup"))
            });
        }

        return { matchedMembers, newMembers }
    }

    async prepareSync(component: NavigationMixin, matched: SGVLidMatch[], newMembers: MemberWithRegistrations[]): Promise<{ oldMembers, action }> {
        // Determine the missing members by checking the matches
        const oldMembers: SGVLid[] = []

        for (const member of this.leden) {
            const found = matched.find(m => m.sgvId == member.id)
            if (!found) {
                oldMembers.push(member)
            }
        }

        if (oldMembers.length > 0) {
            return new Promise((resolve, reject) => {
                // Show a window
                component.present(new ComponentWithProperties(SGVOldMembersView, {
                    members: oldMembers,
                    onCancel: () => {
                        reject(new SimpleError({
                            code: "",
                            message: "Synchronisatie geannuleerd"
                        }))
                    },
                    setAction: async (action: "delete" | "import" | "nothing") => {
                        try {
                            resolve({ oldMembers, action })
                        } catch (e) {
                            reject(e)
                        }
                    }
                }).setDisplayStyle("popup"))
            })
        }

        return {
            oldMembers, action: "nothing"
        }
    }

    async sync(component: NavigationMixin, matched: SGVLidMatch[], newMembers: MemberWithRegistrations[], oldMembers: SGVLid[], action: "delete" | "import" | "nothing", onStatusChange?: (status: string, progress: number) => void) {

        let progress = 0
        const total = (action != "nothing" ? oldMembers.length : 0) + matched.length + newMembers.length

        const report = new SGVSyncReport()

        // todo: import or delete
        const deletedMembers: SGVLid[] = []

        if (action == "delete") {
            // todo: delete
            
            deletedMembers.push(...oldMembers)
            for (const mem of oldMembers) {
                if (onStatusChange) {
                    onStatusChange(mem.firstName+" "+mem.lastName+" schrappen...", progress/total)
                    progress++;

                }
                report.addWarning("Not yet deleted: "+mem.firstName+" "+mem.lastName)
            }
        } else if (action == "import") {
            // todo: import
            //importedMembers.push(...oldMembers)

            for (const mem of oldMembers) {
                if (onStatusChange) {
                    onStatusChange(mem.firstName+" "+mem.lastName+" importeren...", progress/total)
                    progress++;
                }
                report.addWarning("Not yet imported: "+mem.firstName+" "+mem.lastName)
            }
        }

        // Start syncing...
        for (const match of matched) {
            try {
                if (onStatusChange) {
                    onStatusChange(match.stamhoofd.details!.firstName+" "+match.stamhoofd.details!.lastName+" aanpassen...", progress/total)
                    progress++;
                }
                await this.syncLid(match, report)
                report.markSynced(match.stamhoofd)
            } catch (e) {
                report.addError(new SGVMemberError(match.stamhoofd, e))
            }
        }

         // Start creating
        for (const member of newMembers) {
            try {
                if (onStatusChange) {
                    onStatusChange(member.details!.firstName+" "+member.details!.lastName+" toevoegen...", progress/total)
                    progress++;
                }
                await this.createLid(member, report)
                report.markCreated(member)
            } catch (e) {
                report.addError(new SGVMemberError(member, e))
            }
        }

        // Show report
        component.present(new ComponentWithProperties(SGVReportView, {
            report
        }).setDisplayStyle("popup"))
    }

    async syncLid(match: SGVLidMatch, report: SGVSyncReport) {
        console.log("syncing "+match.stamhoofd.firstName);
        const details = match.stamhoofd.details!

        // Fetch full member from SGV
        const response = await this.workAroundAuthenticatedServer.request<any>({
            method: "GET",
            path: "/lid/"+match.sgvId
        })


        const lid = response.data;

        console.log("syncing "+match.stamhoofd.firstName);
        const patch = getPatch(details, lid, this.groupNumber!, match.stamhoofd.groups, OrganizationManager.organization.groups, this.functies, report)

        if (patch.adressen && patch.adressen.length == 0) {
            throw new SimpleError({
                code: "",
                message: "Je moet minstens één adres hebben voor een lid in de groepsadministratie"
            })
        }

        console.log(lid)
        console.info(patch)

        if (!this.dryRun) {
            await sleep(250);

            try {
                const updateResponse = await this.workAroundAuthenticatedServer.request<any>({
                    method: "PATCH",
                    path: "/lid/"+match.sgvId+"?bevestig=true",
                    body: patch
                })
                console.log(updateResponse)

            } catch (e) {
                console.error(e)
                throw e;
            }
        }

        await sleep(250);
    }

    
    /**
     * Create a new one in SGV
     */
    async createLid(member: MemberWithRegistrations, report: SGVSyncReport) {
        console.log("creating "+member.firstName);
        const details = member.details!

        const post = getPatch(details, {
            adressen: [],
            contacten: [],
            functies: []
        }, this.groupNumber!, member.groups, OrganizationManager.organization.groups, this.functies, report)

        if (!post.adressen || post.adressen.length == 0) {
            throw new SimpleError({
                code: "",
                message: "Je moet minstens één adres hebben voor een lid in de groepsadministratie"
            })
        }

        console.info(post)

        if (!this.dryRun) {
            await sleep(250);

            try {
                const updateResponse = await this.workAroundAuthenticatedServer.request<any>({
                    method: "POST",
                    path: "/lid",
                    body: post
                })
                console.log(updateResponse)

            } catch (e) {
                console.error(e)
                throw e;
            }
        }

        await sleep(250);
    }

    checkUrl(): boolean | null {
        const path = window.location.pathname;
        const parts = path.substring(1).split("/");

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'sgv') {
            // Support for both fragment and query string codes.

            const parsedHash = new URLSearchParams(
                window.location.hash.substr(1) // skip the first char (#)
            );
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code') ?? parsedHash.get("code");
            const state = urlParams.get('state') ?? parsedHash.get("state");

            if (code && state) {
                this.getToken(code);
                return true;
            } else {
                new Toast("Inloggen bij groepsadministratie mislukt", "error red").show()
            }
            return false;
        } else {
            return null;
        }
    }

    get loginServer() {
        // We use our own proxy server to https://login.scoutsengidsenvlaanderen.be, because the CORS headers are not set correctly
        // As soon as SGV has fixed this, we can switch back to https://login.scoutsengidsenvlaanderen.be
        //return new Server("https://login.sgv.stamhoofd.dev")
        return new Server("https://login.scoutsengidsenvlaanderen.be")
    }

    get workAroundServer() {
        // Op dit moment geeft de groepsadmin een 403 error als de origin niet overeen komt met scoutsengidsenvlaanderen.
        // Dat hangt ook nog eens vast aan de client id, tis niet zo helemaal duidelijk. De enige oplossing op dit moment
        // is een proxy te gebruiken die de origin header wegknipt.
        // Als er niet snel een fix komt van S&GV moeten we beter een app uitbrengen waar de connectie in kan geplaatst worden
        // zonder proxy, omdat we dan de headers kunnen manipuleren zonder server... #browserstruggles
        //return new Server("https://groepsadmin.sgv.stamhoofd.dev/groepsadmin/rest-ga")
        return new Server("https://groepsadmin.scoutsengidsenvlaanderen.be/groepsadmin/rest-ga")
    }

    get server() {
        return this.workAroundServer
        return new Server("https://groepsadmin.scoutsengidsenvlaanderen.be/groepsadmin/rest-ga")
    }

    get workAroundAuthenticatedServer() {
        const server = this.workAroundServer
        server.middlewares.push(this)
        return server
    }

    get authenticatedServer() {
        const server = this.server
        server.middlewares.push(this)
        return server
    }

     // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (!this.token) {
            // Euhm? The user is not signed in!
            throw new Error("Could not authenticate request without token")
        }

        request.errorDecoder = new SGVFoutenDecoder()
        request.headers["Authorization"] = "Bearer " + this.token.accessToken;
    }

}


export const SGVGroepsadministratie = new SGVGroepsadministratieStatic() 