import { Decoder } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Request, RequestInitializer, RequestMiddleware, RequestResult, Server } from '@simonbackx/simple-networking';
import { ComponentWithProperties, NavigationMixin } from '@simonbackx/vue-app-navigation';
import { Toast } from '@stamhoofd/components';
import { AppManager, SessionManager, sleep, UrlHelper } from '@stamhoofd/networking';
import { createStamhoofdFunctie, getDefaultGroepFuncties, getPatch, getStamhoofdFunctie, GroepFunctie, isManaged, MemberWithRegistrations, Organization, OrganizationPrivateMetaData, schrappen, SGVFoutenDecoder, SGVFunctie, SGVGFunctieResponse, SGVGroep, SGVGroepResponse, SGVLedenResponse, SGVLid, SGVLidMatch, SGVLidMatchVerify, SGVMemberError, SGVProfielResponse, SGVReportIssue, SGVSyncReport, SGVZoekenResponse, SGVZoekLid } from '@stamhoofd/structures';
import { Formatter, Sorter } from '@stamhoofd/utility';

import SGVOldMembersView from '../views/dashboard/scouts-en-gidsen/SGVOldMembersView.vue';
import SGVVerifyProbablyEqualView from '../views/dashboard/scouts-en-gidsen/SGVVerifyProbablyEqualView.vue';
import { MemberManager } from './MemberManager';
import { OrganizationManager } from './OrganizationManager';

class SGVGroepsadministratieStatic implements RequestMiddleware {
    token: {accessToken: string; refreshToken: string; validUntil: Date} | null = null // null to keep reactive
    clientId = "groep-O2209G-Prins-Boudewijn-Wetteren"
    redirectUri = "https://stamhoofd.app/oauth/sgv"
    dryRun = STAMHOOFD.environment != "production"
    
    /**
     * List of all members (pretty low in memory because we don't save a lot of data)
     */
    leden: SGVLid[] = []
    groupNumber: string | null = null
    group: SGVGroep | null = null
    functies: GroepFunctie[] = []

    get hasToken() {
        return !!this.token || this.dryRun
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
        const toast = new Toast("Inloggen...", "spinner").setHide(null).show()

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
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json"
                },
                overrideXMLHttpRequest: AppManager.shared.overrideXMLHttpRequest
            })

            this.token = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                validUntil: new Date(new Date().getTime() + response.data.expires_in * 1000 - 10*1000)
            };

            // Maybe: redirect_uri
            toast.hide()
            new Toast("Ingelogd bij groepsadministratie", "success green").show()
        } catch (e) {
            console.error(e)
            toast.hide()
            new Toast("Inloggen mislukt", "error red").show()
        }
    }

    async refreshToken() {
        if (!this.token) {
            throw new SimpleError({
                code: "",
                message: "Je bent uitgelogd geraakt"
            })
        }

        try {
            const response: RequestResult<any> = await this.loginServer.request({
                method: "POST",
                path: "/auth/realms/scouts/protocol/openid-connect/token",
                body: {
                    client_id: this.clientId,
                    refresh_token: this.token.refreshToken,
                    grant_type: "refresh_token",
                    redirect_uri: this.redirectUri
                },
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Accept: "application/json"
                },
                overrideXMLHttpRequest: AppManager.shared.overrideXMLHttpRequest
            })

            this.token = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                validUntil: new Date(new Date().getTime() + response.data.expires_in * 1000 - 10*1000)
            };

        } catch (e) {
            console.error(e)
            throw new SimpleError({
                code: "",
                message: "Je bent uitgelogd geraakt"
            })
        }
    }

    async setGroupIfNeeded() {
        if (!this.groupNumber) {
            const groups = await this.getGroup()
            if (groups.length === 0) {
                throw new SimpleError({
                    code: "",
                    message: "We konden jouw scoutsgroep niet vinden in dit groepsadministratie account. Controleer het adres en de naam die je in Stamhoofd hebt ingesteld en zorg dat deze overeen komt met de naam in de groepsadministratie."
                })
            }
            if (groups.length > 1) {
                throw new SimpleError({
                    code: "",
                    message: "We vonden meerdere scoutsgroepen die verbonden zijn met dit groepsadministratie account én waarmee de naam of adres overeenkomt met die van jouw groep in Stamhoofd. Daardoor konden we niet automatisch de juiste groep selecteren. Neem contact op via hallo@stamhoofd.be om dit op te lossen."
                })
            }
            this.group = groups[0]
            this.groupNumber = this.group.groepsnummer

            if (!this.groupNumber) {
                throw new SimpleError({
                    code: "missing_group_number",
                    message: "We konden het groepsnummer niet achterhalen van jouw scoutsgroep. Mogelijks is er een tijdelijk probleem met de connectie met de groepsadministratie. Herlaad eventueel de pagina. Neem contact op met hallo@stamhoofd.be als het probleem blijft aanhouden."
                })
            }

            const externalGroupNumber = OrganizationManager.organization.privateMeta?.externalGroupNumber
            if (OrganizationManager.organization.privateMeta && !externalGroupNumber) {
                await OrganizationManager.patch(
                    Organization.patch({
                        id: OrganizationManager.organization.id,
                        privateMeta: OrganizationPrivateMetaData.patch({
                            externalGroupNumber: this.groupNumber
                        })
                    })
                )
            } else {
                if (externalGroupNumber !== this.groupNumber) {
                    throw new SimpleError({
                        code: "wrong_group_number",
                        message: `Het groepsnummer dat we hebben gevonden in de groepsadministratie van dit S&GV account komt niet overeen met het groepsnummer van de scoutsgroep waarmee Stamhoofd het laatst heeft gesynchroniseerd. Kijk na of wel bent ingelogd op het juiste account in de groepsadministratie en probeer opnieuw. Welke van de twee groepsnummers is juist? Laatst gebruikt: ${externalGroupNumber} of groepsnummer huidige account: ${this.groupNumber}? Geef het door aan hallo@stamhoofd.be om het te corrigeren.`
                    })
                }
            }
        }
    }

    // Search the group
    async getGroup(): Promise<SGVGroep[]> {
        const response = await this.tryRequest({
            method: "GET",
            path: "/groep",
            decoder: SGVGroepResponse as Decoder<SGVGroepResponse>
        })

        const organization = OrganizationManager.organization

        const possibleGroups: SGVGroep[] = []

        // Search for the group
        for (const group of response.data.groepen) {
            if (Formatter.slug(group.naam) == Formatter.slug(organization.name)) {
                possibleGroups.push(group)
                continue;
            }
            for (const adres of group.adressen) {
                if (Formatter.slug(adres.straat) == Formatter.slug(organization.address.street) && Formatter.slug(adres.postcode) == Formatter.slug(organization.address.postalCode)) {
                    possibleGroups.push(group)
                    continue;
                }
            }
        }
        return possibleGroups
    }

    async getFuncties() {
        if (!this.groupNumber) {
            throw new Error('Group number not set')
        }
        // Temporary replaced because of issue in API that misses normal member functies
        this.functies = [...getDefaultGroepFuncties()]

        const response = await this.tryRequest({
            method: "GET",
            path: "/functie",
            query: {
                groep: this.groupNumber
            },
            decoder: SGVGFunctieResponse as Decoder<SGVGFunctieResponse>
        })
        const list = response.data.functies;

        // Check if Stamhoofd functie exists
        const stamhoofdFunctie = getStamhoofdFunctie(list);
        if (!stamhoofdFunctie) {
            // Create Stamhoofd functie
            const response = await this.tryRequest({
                method: "POST",
                path: "/functie",
                body: createStamhoofdFunctie(this.groupNumber),
                decoder: SGVFunctie as Decoder<SGVFunctie>
            })

            this.functies.push(response.data);
        } else {
            this.functies.push(stamhoofdFunctie)
        }
    }

    async getProfiel() {
        const response = await this.tryRequest({
            method: "GET",
            path: "/lid/profiel",
            decoder: SGVProfielResponse as Decoder<SGVProfielResponse>
        })
        return response.data
    }

    async checkFuncties() {
        const profiel = await this.getProfiel()

        // Check if this user has access to all the needed groups...
        if (!profiel.functies.find(f => (f.code == 'VGA' || f.code == 'GRL' || 'AVGA') && f.isActive && f.groep === this.groupNumber)) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Log in met een account met minstens de functies (Adjunct) Verantwoordelijke Groepsadministratie (VGA) of groepsleiding in de groepsadministratie."
            })
        }
        await this.getFuncties()
    }

    async setManagedFilter() {
        await this.tryRequest({
            method: "PATCH",
            path: "/ledenlijst/filter/huidige",
            body: {
                "criteria":{
                    //"functies": this.functies.map(f => f.id),
                    "functies": [],
                    "groepen": [this.groupNumber ],
                    "oudleden": false,
                },
                "kolommen":[
                    "be.vvksm.groepsadmin.model.column.LidNummerColumn",
                    "be.vvksm.groepsadmin.model.column.VoornaamColumn",
                    "be.vvksm.groepsadmin.model.column.AchternaamColumn",
                    "be.vvksm.groepsadmin.model.column.GeboorteDatumColumn"
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
    async zoekGelijkaardig(member: MemberWithRegistrations): Promise<SGVZoekLid | undefined> {
        const response = await this.tryRequest({
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

            for (const lid of response.data.leden) {
                if (lid.isProbablyEqualLastResort(member)) {
                    return lid
                }
            }
        }
    }

    async downloadAll() {
        if (this.dryRun) {
            await this.getFuncties()
            this.leden = [new SGVLid({
                id: '3',
                firstName: 'Existing',
                lastName: 'Member',
                lidNummer: '123',
                birthDay: new Date(2000, 1, 1, 12),
            })]
            return;
        }

        await this.setGroupIfNeeded();
        await this.checkFuncties()
        await this.setManagedFilter()

        try {
            this.leden = await this.downloadWithCurrentFilter()
        } catch (e) {
            console.error(e)
            new Toast("Leden ophalen mislukt", "error red").show()
            throw e;
        }
    }

    async downloadWithCurrentFilter() {
        const leden: SGVLid[] = []
        let offset = 0
        let total = 1

        while (offset < total) {
            // prevent brute force attack, spread the load
            await sleep(100);
            const response = await this.tryRequest({
                method: "GET",
                path: "/ledenlijst",
                query: {
                    aantal: 100,
                    offset: offset
                },
                decoder: SGVLedenResponse as Decoder<SGVLedenResponse>
            })
            leden.push(...response.data.leden)

            // Set new offset
            offset = response.data.offset + response.data.aantal
            total = response.data.totaal
        }
        return leden;
    }

    async matchAndSync(component: NavigationMixin, onPopup: () => void): Promise<{ matchedMembers; newMembers }> {
        // Members that are missing in groepsadmin
        let newMembers: MemberWithRegistrations[] = []

        const matchedMembers: SGVLidMatch[] = []
        const probablyEqualList: SGVLidMatchVerify[] = []

        // Start! :D
        const allMembers = await MemberManager.loadMembers([], false)

        if (this.dryRun && allMembers.length >= 1) {
            // Add some fake data
            matchedMembers.push({
                stamhoofd: allMembers[0],
                sgvId: '1'
            })

            probablyEqualList.push({
                stamhoofd: allMembers[1],
                sgv: new SGVLid({
                    id: '2',
                    firstName: 'John',
                    lastName: 'Doe',
                    lidNummer: '123',
                    birthDay: new Date(2000, 1, 1, 12),
                }),
                verify: true
            })
        } else {
            for (const member of allMembers) {
                const sgvMember = this.leden.find((sgvLid) => {
                    return sgvLid.isEqual(member)
                })

                if (sgvMember) {
                    matchedMembers.push({
                        stamhoofd: member,
                        sgvId: sgvMember.id
                    })

                } else {
                    // Lid niet gevonden, zoeken in groepsadmin...
                    const gelijkaardig = await this.zoekGelijkaardig(member)
                    if (gelijkaardig) {
                        if (gelijkaardig.isEqual(member)) {
                            // Gevonden
                            matchedMembers.push({
                                stamhoofd: member,
                                sgvId: gelijkaardig.id
                            })
                        } else {
                            // Gelijkaardig, maar niet gelijk
                            probablyEqualList.push({
                                stamhoofd: member,
                                sgv: gelijkaardig,
                                verify: true
                            })
                        }
                    } else {
                        // Is echt een nieuw lid
                        newMembers.push(member)
                    }
                    await sleep(100)
                }
            }
        }

        newMembers = newMembers.filter((member) => {
            const sgvMember = this.leden.find((sgvLid) => {
                return sgvLid.isProbablyEqual(member)
            }) 
            if (sgvMember) {
                probablyEqualList.push({
                    stamhoofd: member,
                    sgv: sgvMember,
                    verify: true
                })
                return false
            }

            const sgvMember2 = this.leden.find((sgvLid) => {
                return sgvLid.isProbablyEqualLastResort(member)
            })

            if (sgvMember2) {
                probablyEqualList.push({
                    stamhoofd: member,
                    sgv: sgvMember2,
                    verify: false
                })
                return false
            }
            return true;
        })

        /*console.log("matched members:")
        console.log(matchedMembers)

        console.log("newMembers:")
        console.log(newMembers)

        console.log("Manual verify probably equal list:")
        console.log(probablyEqualList)*/

        if (probablyEqualList.length > 0) {
            onPopup()
            await new Promise<void>((resolve, reject) => {
                let resolved = false
                component.present(new ComponentWithProperties(SGVVerifyProbablyEqualView, {
                    matches: probablyEqualList,
                    onCancel: () => {
                        if (resolved) {
                            return;
                        }
                        resolved = true;
                        reject(new SimpleError({
                            code: "",
                            message: "Synchronisatie geannuleerd"
                        }))
                    },
                    onVerified: (verified: SGVLidMatchVerify[]) => {
                        if (resolved) {
                            return;
                        }
                        resolved = true;

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
                            resolve()
                        } catch (e) {
                            reject(e)
                        }
                    }   
                }).setDisplayStyle("popup"))
            });
        }

        return { matchedMembers, newMembers }
    }

    async prepareSync(component: NavigationMixin, report: SGVSyncReport, matched: SGVLidMatch[], newMembers: MemberWithRegistrations[]): Promise<{ oldMembers; action }> {
        // Determine the missing members by checking the matches
        const oldMembers: SGVLid[] = []
        const toast = new Toast("Controleren op gestopte leden...", "spinner").setHide(null).show()

        try {
            for (const member of this.leden) {
                const found = matched.find(m => m.sgvId == member.id)
                if (!found) {
                    const lid = await this.fetchLid(member.id)
                    if (isManaged(lid, this.functies)) {
                        // Alleen vragen om leden te schrappen die een vaste functie hebben in de groepsadministratie
                        oldMembers.push(member)
                    } else {
                        // Add report warning
                        report.markUnmanagedMissing(lid)
                        //report?.addWarning(`${member.firstName} ${member.lastName} staat in de groepsadministratie en niet in Stamhoofd, maar de bijhorende functies worden niet beheerd door Stamhoofd (leiding of vrijwilliger) en zal daardoor ook niet automatisch geschrapt worden. Kijk de gegevens zelf na in de groepsadministratie en schrap indien nodig.`)
                    }
                }
            }
        } finally {
            toast.hide()
        }

        if (oldMembers.length > 0) {
            return new Promise((resolve, reject) => {
                // Show a window
                let resolved = false;
                component.present(new ComponentWithProperties(SGVOldMembersView, {
                    members: oldMembers,
                    onCancel: () => {
                        if (resolved) {
                            return;
                        }
                        resolved = true;
                        reject(new SimpleError({
                            code: "",
                            message: "Synchronisatie geannuleerd"
                        }))
                    },
                    setAction: (action: "delete" | "import" | "nothing") => {
                        if (resolved) {
                            return;
                        }
                        resolved = true;
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

    async sync(component: NavigationMixin, report: SGVSyncReport, matched: SGVLidMatch[], newMembers: MemberWithRegistrations[], oldMembers: SGVLid[], action: "delete" | "import" | "nothing", onStatusChange?: (status: string, progress: number) => void) {

        let progress = 0
        const total = (action != "nothing" ? oldMembers.length : 0) + matched.length + newMembers.length

        const deletedMembers: SGVLid[] = []

        if (action == "delete") {            
            deletedMembers.push(...oldMembers)
            for (const mem of oldMembers) {
                if (onStatusChange) {
                    onStatusChange(mem.firstName+" "+mem.lastName+" schrappen...", progress/total)
                    progress++;
                }

                try {
                    await this.schrapLid(mem, report)
                    report.markDeleted(mem)
                } catch (e) {
                    report.addError(new SGVMemberError(mem, e))
                }
            }
        } else if (action == "import") {
            // TODO: import
            //importedMembers.push(...oldMembers)

            for (const mem of oldMembers) {
                if (onStatusChange) {
                    onStatusChange(mem.firstName+" "+mem.lastName+" importeren...", progress/total)
                    progress++;
                }
                report.addWarning("Not yet imported: "+mem.firstName+" "+mem.lastName)
            }
        }

        // Start creating
        for (const member of newMembers) {
            try {
                if (onStatusChange) {
                    onStatusChange(member.details!.firstName+" "+member.details!.lastName+" toevoegen...", progress/total)
                    progress++;
                }
                const lid = await this.createLid(member, report)
                report.markCreated(member, lid)
            } catch (e) {
                report.addError(new SGVMemberError(member, e))
            }
        }

        matched.sort((a, b) => Sorter.byDateValue(b.stamhoofd.details?.lastExternalSync ?? new Date(1900, 0, 1), a.stamhoofd.details?.lastExternalSync ?? new Date(1900, 0, 1)));

        // Start syncing...
        for (const match of matched) {
            try {
                // If updatedAt close to lastsynced at (5 seconds)
                if (match.stamhoofd.syncStatus === 'ok') {
                    //report.addWarning(match.stamhoofd.details.firstName+" "+match.stamhoofd.details.lastName+" werd overgeslagen: geen wijzigingen sinds laatste synchronisatie");
                    report.markSkipped(match.stamhoofd)
                    continue;
                }
                if (onStatusChange) {
                    onStatusChange(match.stamhoofd.details!.firstName+" "+match.stamhoofd.details!.lastName+" aanpassen...", progress/total)
                    progress++;
                }
                const lid = await this.syncLid(match, report)
                report.markSynced(match.stamhoofd, lid)
            } catch (e) {
                report.addError(new SGVMemberError(match.stamhoofd, e))
            }
        }
    }

    async schrapLid(lid: SGVLid, report: SGVSyncReport) {
        // Fetch full member from SGV
        const response = await this.tryRequest<any>({
            method: "GET",
            path: "/lid/"+lid.id
        })

        const lidData = response.data;
        const patch = schrappen(lidData, this.functies)

        await sleep(200);
            
        if (!this.dryRun) {

            try {
                await this.tryRequest<any>({
                    method: "PATCH",
                    path: "/lid/"+lid.id+"?bevestig=true",
                    body: patch
                })

            } catch (e) {
                console.error(e)
                throw e;
            }
        }

        await sleep(200);
    }

    async fetchLid(sgvId: string) {
        if (this.dryRun) {
            return {
                "links": [],
                "id": sgvId,
                "aangepast": "2023-01-01T00:00:00.000+02:00",
                "persoonsgegevens": {
                    "geslacht": "vrouw",
                    "gsm": "+32 411 11 11 11"
                },
                "vgagegevens": {
                    "voornaam": "Test",
                    "achternaam": "Testlid",
                    "geboortedatum": "2005-01-01",
                    "beperking": false,
                    "verminderdlidgeld": false,
                    "individueleSteekkaartdatumaangepast": "2024-09-01"
                },
                "verbondsgegevens": {
                    "lidnummer": "1234567890",
                    "klantnummer": "I00000",
                    "lidgeldbetaald": false,
                    "lidkaartafgedrukt": false
                },
                "email": "",
                "adressen": [
                    {
                        "id": "1234",
                        "land": "BE",
                        "postcode": "9000",
                        "gemeente": "Gent",
                        "straat": "Demostraat",
                        "nummer": "1",
                        "bus": "",
                        "telefoon": "",
                        "postadres": true,
                        "status": "normaal",
                        "positie": {
                            "latitude": 0,
                            "longitude": 0
                        },
                        "omschrijving": ""
                    }
                ],
                "contacten": [
                    {
                        "id": "12345",
                        "adres": "1234",
                        "voornaam": "Testpersoon",
                        "achternaam": "Test",
                        "zelfdeAdres": false,
                        "gsm": "+32 411 11 11 11",
                        "email": "voorbeeld@geenemail.be",
                        "rol": "moeder"
                    }
                ],
                "groepseigenVelden": {},
                "functies": [
                    {
                        "links": [],
                        "groep": "O1234",
                        "functie": "d5f75b320b812440010b812555c1039b",
                        "begin": "2020-01-01T00:00:00.000+02:00",
                        "code": "JIN",
                        "omschrijving": "Jin"
                    }
                ]
            }
        }
        // Fetch full member from SGV
        const response = await this.tryRequest<any>({
            method: "GET",
            path: "/lid/"+sgvId
        })
        await sleep(200);

        return response.data;
    }

    async tryRequest<T>(request: RequestInitializer<T>): Promise<RequestResult<T>> {
        try {
            return await this.authenticatedServer.request(request)
        } catch (e) {
            if (!Request.isNetworkError(e)) {
                await this.reportIssue(SGVReportIssue.create({
                    method: request.method,
                    path: request.path,
                    query: request.query,
                    body: request.body,
                    error: this.getErrorMessage(e)
                }));
            }
            throw e;
        }
    }

    async reportIssue(issue: SGVReportIssue) {
        try {
            const session = SessionManager.currentSession!;
            await session.authenticatedServer.request({
                method: "POST",
                path: "/sgv/report-issue",
                body: issue
            });

        } catch (e) {
            console.error('Failed to report issue', issue, e)
        }
    }

    getErrorMessage(error: unknown): string {
        if (typeof error === 'string') {
            return error
        }
        if (error === null || typeof error !== 'object') {
            return 'Er is een onbekende fout opgetreden'
        }

        if (error instanceof SGVMemberError) {
            return this.getErrorMessage(error.error)
        }

        if (Request.isNetworkError(error)) {
            return 'De groepsadministratie gaf een interne foutmelding of reageerde niet. Mogelijks zit er een fout in de groepsadministratie als gevolg van een recente update. Probeer later opnieuw.'
        }
        if (!isSimpleError(error) && !isSimpleErrors(error)) {
            if ('message' in error && typeof error.message === 'string') {
                if (error.message.startsWith('<!DOCTYPE') || error.message.startsWith('<html') || error.message.length > 1000) {
                    return 'De groepsadministratie gaf een interne foutmelding of reageerde niet. Mogelijks zit er een fout in de groepsadministratie als gevolg van een recente update. Probeer later opnieuw.'
                }

                return error.message
            }
            return 'Er is een onleesbare fout opgetreden'
        }
        if (error.hasCode('SGVError')) {
            return 'De groepsadministratie gaf volgende foutmelding terug: ' + error.getHuman()
        }
        return error.getHuman()
    }

    async syncLid(match: SGVLidMatch, report: SGVSyncReport) {
        let doAnotherPatch = true;
        let patchCount = 0;
        let lid;
        let shouldMarkExternalSync = true;
        const withHacks = false;

        while(doAnotherPatch) {
            patchCount++;
            if (patchCount > 5) {
                console.warn("Too many patches, breaking", lid)
                shouldMarkExternalSync = false;
                break;
            }
            lid = await this.fetchLid(match.sgvId)

            const {patch, needsMultiplePatches} = getPatch(match.stamhoofd, lid, this.groupNumber!, match.stamhoofd.groups, this.functies, report, withHacks)
            doAnotherPatch = needsMultiplePatches;

            if (patch.adressen && patch.adressen.length == 0) {
                throw new SimpleError({
                    code: "",
                    message: "Je moet minstens één adres toevoegen in Stamhoofd voor we dat lid kunnen toevoegen in de groepsadministratie"
                })
            }

            if (!this.dryRun) {
                try {
                    const updateResponse = await this.tryRequest<any>({
                        method: "PATCH",
                        path: "/lid/"+match.sgvId+"?bevestig=true",
                        body: patch,
                    })
                    match.stamhoofd.details.memberNumber = updateResponse.data.verbondsgegevens.lidnummer ?? null

                    lid = updateResponse.data
                } catch (e) {
                    console.error(e)
                    throw e;
                }
            }
        }

        try {
            // Mark as synced in Stamhoofd
            if (shouldMarkExternalSync) {
                match.stamhoofd.details.lastExternalSync = new Date()
            }
            await MemberManager.patchMembersDetails([match.stamhoofd])
        } catch (e) {
            console.error(e)
            throw e;
        }

        await sleep(200);

        return lid;
    }

    
    /**
     * Create a new one in SGV
     */
    async createLid(member: MemberWithRegistrations, report: SGVSyncReport) {
        const {patch: post, needsMultiplePatches} = getPatch(member, {
            adressen: [],
            contacten: [],
            functies: []
        }, this.groupNumber!, member.groups, this.functies, report);
        let patchAfter = needsMultiplePatches;

        if (!post.adressen || post.adressen.length == 0) {
            throw new SimpleError({
                code: "",
                message: "Je moet minstens één adres hebben voor een lid in de groepsadministratie"
            })
        }

        let lid: any;

        if (!this.dryRun) {
            await sleep(100);

            try {
                if (post.functies && post.functies.length > 1) {
                    // SGV doesn't support adding multiple functies in one go for new members (...)
                    post.functies = [post.functies[0]]
                    const updateResponse = await this.tryRequest<any>({
                        method: "POST",
                        path: "/lid?bevestig=true",
                        body: post
                    })

                    lid = updateResponse.data

                    // Do a patch for the remaining functies
                    patchAfter = true;
                } else {
                    const updateResponse = await this.tryRequest<any>({
                        method: "POST",
                        path: "/lid?bevestig=true",
                        body: post
                    })
                    
                    lid = updateResponse.data

                    // Mark as synced in Stamhoofd
                    member.details.memberNumber = lid.verbondsgegevens?.lidnummer ?? null
                    member.details.lastExternalSync = new Date()
                    await MemberManager.patchMembersDetails([member])

                    lid = updateResponse.data
                }

                if (patchAfter) {
                    // Do another patch to set everything correctly
                    lid = await this.syncLid({
                        stamhoofd: member,
                        sgvId: lid.id
                    }, report);
                }
            } catch (e) {
                console.error(e)
                throw e;
            }
        }

        await sleep(100);
        return lid;
    }

    checkUrl(): boolean | null {
        const parts =  UrlHelper.shared.getParts()
        const parsedHash =  UrlHelper.shared.getHashParams()
        const urlParams =  UrlHelper.shared.getSearchParams()
        UrlHelper.shared.clear()

        if (parts.length == 2 && parts[0] == 'oauth' && parts[1] == 'sgv') {
            // Support for both fragment and query string codes.
            const code = urlParams.get('code') ?? parsedHash.get("code");
            const state = urlParams.get('state') ?? parsedHash.get("state");

            if (code && state) {
                this.getToken(code).catch(console.error);
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
        //return new Server("https://login.sgv.stamhoofd.app")
        if (SessionManager.currentSession?.user?.email?.endsWith('@stamhoofd.be')) {
            return new Server("https://login-sgv.api.staging.stamhoofd.app")
        }
        return new Server("https://login.scoutsengidsenvlaanderen.be")
    }

    get server() {
        if (SessionManager.currentSession?.user?.email?.endsWith('@stamhoofd.be')) {
            return new Server("https://groepsadmin-sgv.api.staging.stamhoofd.app")
        }
        return new Server("https://groepsadmin.scoutsengidsenvlaanderen.be/groepsadmin/rest-ga")
    }

    get authenticatedServer() {
        const server = this.server
        server.middlewares.push(this)
        return server
    }

    // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (this.dryRun) {
            return;
        }

        if (!this.token) {
            // Euhm? The user is not signed in!
            throw new Error("Could not authenticate request without token")
        }

        if (this.token.validUntil < new Date()) {
            // Normally we would need to check if we are already refreshing, but since we only do sync requests this is not needed
            await this.refreshToken()
        }

        request.overrideXMLHttpRequest = AppManager.shared.overrideXMLHttpRequest
        request.errorDecoder = new SGVFoutenDecoder()
        request.headers["Authorization"] = "Bearer " + this.token.accessToken;
        request.headers["Accept"] = "application/json";

        // The server is a bit buggy, so always parse as JSON
        request.responseContentTypeOverride = "application/json"
    }
}


export const SGVGroepsadministratie = new SGVGroepsadministratieStatic() 