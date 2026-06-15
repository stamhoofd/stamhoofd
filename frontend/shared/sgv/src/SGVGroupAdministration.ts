import { SimpleError } from '@simonbackx/simple-errors';
import type {
    RequestInitializer,
    RequestMiddleware,
    RequestResult,
} from '@simonbackx/simple-networking';
import { Request, Server } from '@simonbackx/simple-networking';
import type { PushOptions } from '@simonbackx/vue-app-navigation';
import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { Toast } from '@stamhoofd/components/overlays/Toast.ts';
import type { MemberManager } from '@stamhoofd/networking/MemberManager';
import type { OrganizationManager } from '@stamhoofd/networking/OrganizationManager';
import type { SessionContext } from '@stamhoofd/networking/SessionContext';
import type { SGVGroep, SGVLedenLijstFilterResponse, SGVLid, SGVLidBevestig, SGVLidGet, SGVLidMatch, SGVLidMatchVerify, SGVZoekLid } from '@stamhoofd/sgv';
import {
    SGVFoutenDecoder, SGVFunctie, SGVGFunctieResponse, SGVGroepResponse, SGVLedenLijstResponse, SGVMemberError,
    SGVProfielResponse,
    SGVReportIssue, SGVZoekenResponse,
} from '@stamhoofd/sgv';
import type {
    Member,
    MembersBlob,
} from '@stamhoofd/structures';
import {
    MemberDetails,
    MemberWithRegistrationsBlob, Organization,
    OrganizationPrivateMetaData,
    SGVSyncStatus,
} from '@stamhoofd/structures';
import { Formatter, sleep } from '@stamhoofd/utility';
import SGVOldMembersView from './components/SGVOldMembersView.vue';
import SGVVerifyProbablyEqualView from './components/SGVVerifyProbablyEqualView.vue';
import type { SGVOAuth } from './SGVOAuth.ts';
import type { GroepFunctie, SGVSyncReport } from './SGVSyncReport.ts';
import {
    createStamhoofdFunctie,
    getDefaultGroepFuncties,
    getPatch,
    getStamhoofdFunctie,
    isManaged,
    schrappen,
} from './SGVSyncReport.ts';

import type { Decoder, PatchableArrayAutoEncoder } from '@simonbackx/simple-encoding';
import { PatchableArray } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors } from '@simonbackx/simple-errors';
import { Sorter } from '@stamhoofd/utility';

export enum SGVOldMemberAction {
    Delete = 'delete',
    Nothing = 'nothing',
}

export class SGVGroupAdministration implements RequestMiddleware {
    /**
     * List of all members (pretty low in memory because we don't save a lot of data)
     */
    leden: SGVLid[] = [];
    groupNumber: string | null = null;
    group: SGVGroep | null = null;
    functies: GroepFunctie[] = [];

    constructor(
        private readonly context: SessionContext,
        private readonly organizationManager: OrganizationManager,
        private readonly memberManager: MemberManager,
        private readonly oauth: SGVOAuth,
    ) {}

    async setGroupIfNeeded() {
        if (!this.groupNumber) {
            let groups = await this.getGroup();
            if (groups.length === 0) {
                throw new SimpleError({
                    code: '',
                    message:
                        'We konden jouw scoutsgroep niet vinden in dit groepsadministratie account. Controleer het adres en de naam die je in Stamhoofd hebt ingesteld en zorg dat deze overeen komt met de naam in de groepsadministratie.',
                });
            }
            if (groups.length > 1) {
                if (
                    this.organizationManager.organization.privateMeta
                        ?.externalGroupNumber
                ) {
                    const preferredGroup = groups.find(
                        g =>
                            g.groepsnummer
                            === this.organizationManager.organization.privateMeta
                                ?.externalGroupNumber,
                    );
                    if (preferredGroup) {
                        groups = [preferredGroup];
                    }
                }
            }

            if (groups.length > 1) {
                // not fixed? throw
                throw new SimpleError({
                    code: '',
                    message:
                        'We vonden meerdere scoutsgroepen die verbonden zijn met dit groepsadministratie account én waarmee de naam of adres overeenkomt met die van jouw groep in Stamhoofd. Daardoor konden we niet automatisch de juiste groep selecteren. Neem contact op via hallo@stamhoofd.be om dit op te lossen.',
                });
            }

            this.group = groups[0];
            this.groupNumber = this.group.groepsnummer;

            if (!this.groupNumber) {
                throw new SimpleError({
                    code: 'missing_group_number',
                    message:
                        'We konden het groepsnummer niet achterhalen van jouw scoutsgroep. Mogelijks is er een tijdelijk probleem met de connectie met de groepsadministratie. Herlaad eventueel de pagina. Neem contact op met hallo@stamhoofd.be als het probleem blijft aanhouden.',
                });
            }

            const externalGroupNumber
                = this.organizationManager.organization.privateMeta
                    ?.externalGroupNumber;
            if (
                this.organizationManager.organization.privateMeta
                && !externalGroupNumber
            ) {
                await this.organizationManager.patch(
                    Organization.patch({
                        id: this.organizationManager.organization.id,
                        privateMeta: OrganizationPrivateMetaData.patch({
                            externalGroupNumber: this.groupNumber,
                        }),
                    }),
                );
            } else {
                if (externalGroupNumber !== this.groupNumber) {
                    throw new SimpleError({
                        code: 'wrong_group_number',
                        message: `Het groepsnummer dat we hebben gevonden in de groepsadministratie van dit S&GV account komt niet overeen met het groepsnummer van de scoutsgroep waarmee Stamhoofd het laatst heeft gesynchroniseerd. Kijk na of wel bent ingelogd op het juiste account in de groepsadministratie en probeer opnieuw. Welke van de twee groepsnummers is juist? Laatst gebruikt: ${externalGroupNumber} of groepsnummer huidige account: ${this.groupNumber}? Geef het door aan hallo@stamhoofd.be om het te corrigeren.`,
                    });
                }
            }
        }
    }

    // Search the group
    async getGroup(): Promise<SGVGroep[]> {
        const response = await this.tryRequest<SGVGroepResponse>({
            method: 'GET',
            path: '/groep',
            decoder: SGVGroepResponse as Decoder<SGVGroepResponse>,
        });

        const organization = this.organizationManager.organization;

        const possibleGroups: SGVGroep[] = [];

        // Search for the group
        for (const group of response.data.groepen) {
            if (
                Formatter.slug(group.naam) === Formatter.slug(organization.name)
            ) {
                possibleGroups.push(group);
                continue;
            }
            for (const adres of group.adressen) {
                if (
                    Formatter.slug(adres.straat)
                    === Formatter.slug(organization.address.street)
                    && Formatter.slug(adres.postcode)
                    === Formatter.slug(organization.address.postalCode)
                ) {
                    possibleGroups.push(group);
                    continue;
                }
            }
        }
        return possibleGroups;
    }

    async getFuncties() {
        if (!this.groupNumber) {
            throw new Error('Group number not set');
        }
        // Temporary replaced because of issue in API that misses normal member functies
        this.functies = [...getDefaultGroepFuncties()];

        const response = await this.tryRequest<SGVGFunctieResponse>({
            method: 'GET',
            path: '/functie',
            query: {
                groep: this.groupNumber,
            },
            decoder: SGVGFunctieResponse as Decoder<SGVGFunctieResponse>,
        });
        const list = response.data.functies;

        // Check if Stamhoofd functie exists
        const stamhoofdFunctie = getStamhoofdFunctie(list);
        if (!stamhoofdFunctie) {
            // Create Stamhoofd functie
            const response = await this.tryRequest<SGVFunctie>({
                method: 'POST',
                path: '/functie',
                body: createStamhoofdFunctie(this.groupNumber),
                decoder: SGVFunctie as Decoder<SGVFunctie>,
            });

            this.functies.push(response.data);
        } else {
            this.functies.push(stamhoofdFunctie);
        }
    }

    async getProfiel(): Promise<SGVProfielResponse> {
        const response = await this.tryRequest<SGVProfielResponse>({
            method: 'GET',
            path: '/lid/profiel',
            decoder: SGVProfielResponse as Decoder<SGVProfielResponse>,
        });
        return response.data;
    }

    async checkFuncties(): Promise<void> {
        const profiel = await this.getProfiel();

        // Check if this user has access to all the needed groups...
        if (
            !profiel.functies.find(
                (f) => {
                    console.log(`code: ${f.code}`);
                    console.log(`isActive: ${f.isActive}`);
                    console.log(`groep: ${f.groep}`);
                    console.log(`this.groupNumber: ${this.groupNumber}`);
                    return ((f.code === 'VGA' || f.code === 'AVGA')
                        && f.isActive
                        && f.groep === this.groupNumber);
                },
            )
        ) {
            throw new SimpleError({
                code: 'permission_denied',
                message:
                    'Je kan enkel synchroniseren vanaf een account in de groepsadministratie met de functie (Adjunct) Verantwoordelijke Groepsadministratie (VGA).',
            });
        }
        await this.getFuncties();
    }

    async setManagedFilter(): Promise<void> {
        await this.tryRequest<SGVLedenLijstFilterResponse>({
            method: 'PATCH',
            path: '/ledenlijst/filter/huidige',
            body: {
                criteria: {
                    // "functies": this.functies.map(f => f.id),
                    functies: [],
                    groepen: [this.groupNumber],
                    oudleden: false,
                },
                kolommen: [
                    'be.vvksm.groepsadmin.model.column.LidNummerColumn',
                    'be.vvksm.groepsadmin.model.column.VoornaamColumn',
                    'be.vvksm.groepsadmin.model.column.AchternaamColumn',
                    'be.vvksm.groepsadmin.model.column.GeboorteDatumColumn',
                ],
                groepen: [],
                sortering: [
                    'be.vvksm.groepsadmin.model.column.LidNummerColumn',
                ],
                type: 'lid',
            },
        });
    }

    /**
     * Voor we een lid als 'nieuw' beschouwen moeten we echt zeker zijn
     */
    async zoekGelijkaardig(
        member: MemberWithRegistrationsBlob,
    ): Promise<SGVZoekLid | undefined> {
        const response = await this.tryRequest<SGVZoekenResponse>({
            method: 'GET',
            path: '/zoeken/gelijkaardig',
            query: {
                voornaam: member.details!.firstName,
                achternaam: member.details!.lastName,
            },
            decoder: SGVZoekenResponse as Decoder<SGVZoekenResponse>,
        });
        if (response.data.leden.length > 0) {
            for (const lid of response.data.leden) {
                if (lid.isEqual(member)) {
                    return lid;
                }
            }

            for (const lid of response.data.leden) {
                if (lid.isProbablyEqual(member)) {
                    return lid;
                }
            }

            for (const lid of response.data.leden) {
                if (lid.isProbablyEqualLastResort(member)) {
                    return lid;
                }
            }
        }
    }

    async downloadAll(): Promise<void> {
        await this.setGroupIfNeeded();
        await this.checkFuncties();
        await this.setManagedFilter();

        try {
            this.leden = await this.downloadWithCurrentFilter();
        } catch (e) {
            console.error(e);
            new Toast('Leden ophalen mislukt', 'error red').show();
            throw e;
        }
    }

    async downloadWithCurrentFilter(): Promise<SGVLid[]> {
        const leden: SGVLid[] = [];
        let offset = 0;
        let total = 1;

        while (offset < total) {
            // prevent brute force attack, spread the load
            await sleep(100);
            const response = await this.tryRequest<SGVLedenLijstResponse>({
                method: 'GET',
                path: '/ledenlijst',
                query: { // SGVLedenRequest
                    aantal: 100,
                    offset: offset,
                },
                decoder: SGVLedenLijstResponse as Decoder<SGVLedenLijstResponse>,
            });
            leden.push(...response.data.leden);

            // Set new offset
            offset = response.data.offset + response.data.aantal;
            total = response.data.totaal;
        }
        return leden;
    }

    async matchAndSync(
        present: { (options: PushOptions | ComponentWithProperties): Promise<void>; (arg0: ComponentWithProperties): void },
        onPopup: () => void,
        allMembers: MemberWithRegistrationsBlob[],
    ): Promise<{
            matchedMembers: SGVLidMatch[];
            newMembers: MemberWithRegistrationsBlob[];
        }> {
        // Members that are missing in groepsadmin
        let newMembers: MemberWithRegistrationsBlob[] = [];

        const matchedMembers: SGVLidMatch[] = [];
        const probablyEqualList: SGVLidMatchVerify[] = [];

        // Start! :D
        for (const member of allMembers) {
            const sgvMember = this.leden.find((sgvLid) => {
                return sgvLid.isEqual(member);
            });

            if (sgvMember) {
                matchedMembers.push({
                    stamhoofd: member,
                    sgvId: sgvMember.id,
                });
            } else {
                // Lid niet gevonden, zoeken in groepsadmin...
                const gelijkaardig = await this.zoekGelijkaardig(member);
                if (gelijkaardig) {
                    if (gelijkaardig.isEqual(member)) {
                        // Gevonden
                        matchedMembers.push({
                            stamhoofd: member,
                            sgvId: gelijkaardig.id,
                        });
                    } else {
                        // Gelijkaardig, maar niet gelijk
                        probablyEqualList.push({
                            stamhoofd: member,
                            sgv: gelijkaardig,
                            verify: true,
                        });
                    }
                } else {
                    // Is echt een nieuw lid
                    newMembers.push(member);
                }
                await sleep(100);
            }
        }

        newMembers = newMembers.filter((member) => {
            const sgvMember = this.leden.find((sgvLid) => {
                return sgvLid.isProbablyEqual(member);
            });
            if (sgvMember) {
                probablyEqualList.push({
                    stamhoofd: member,
                    sgv: sgvMember,
                    verify: true,
                });
                return false;
            }

            const sgvMember2 = this.leden.find((sgvLid) => {
                return sgvLid.isProbablyEqualLastResort(member);
            });

            if (sgvMember2) {
                probablyEqualList.push({
                    stamhoofd: member,
                    sgv: sgvMember2,
                    verify: false,
                });
                return false;
            }
            return true;
        });

        /* console.log("matched members:")
        console.log(matchedMembers)

        console.log("newMembers:")
        console.log(newMembers)

        console.log("Manual verify probably equal list:")
        console.log(probablyEqualList) */

        if (probablyEqualList.length > 0) {
            onPopup();
            await new Promise<void>((resolve, reject) => {
                let resolved = false;
                present(
                    new ComponentWithProperties(SGVVerifyProbablyEqualView, {
                        matches: probablyEqualList,
                        onCancel: () => {
                            if (resolved) {
                                return;
                            }
                            resolved = true;
                            reject(
                                new SimpleError({
                                    code: '',
                                    message: 'Synchronisatie geannuleerd',
                                }),
                            );
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
                                            sgvId: member.sgv.id,
                                        });
                                    } else {
                                        newMembers.push(member.stamhoofd);
                                    }
                                }
                                resolve();
                            } catch (e) {
                                reject(e);
                            }
                        },
                    }).setDisplayStyle('popup'),
                ).catch(reject);
            });
        }

        return { matchedMembers, newMembers };
    }

    async prepareSync(
        present: (options: PushOptions | ComponentWithProperties) => Promise<void>,
        report: SGVSyncReport,
        matched: SGVLidMatch[],
    ): Promise<{ oldMembers: SGVLid[]; action: SGVOldMemberAction }> {
        // Determine the missing members by checking the matches
        const oldMembers: SGVLid[] = [];
        const toast = new Toast('Controleren op gestopte leden...', 'spinner')
            .setHide(null)
            .show();

        try {
            for (const member of this.leden) {
                const found = matched.find(m => m.sgvId == member.id);
                if (!found) {
                    const lid = await this.fetchLid(member.id);
                    if (isManaged(lid, this.functies)) {
                        // Alleen vragen om leden te schrappen die een vaste functie hebben in de groepsadministratie
                        oldMembers.push(member);
                    } else {
                        // Add report warning
                        report.markUnmanagedMissing(lid);
                        // report?.addWarning(`${member.firstName} ${member.lastName} staat in de groepsadministratie en niet in Stamhoofd, maar de bijhorende functies worden niet beheerd door Stamhoofd (leiding of vrijwilliger) en zal daardoor ook niet automatisch geschrapt worden. Kijk de gegevens zelf na in de groepsadministratie en schrap indien nodig.`)
                    }
                }
            }
        } finally {
            toast.hide();
        }

        if (oldMembers.length > 0) {
            return new Promise((resolve, reject) => {
                // Show a window
                let resolved = false;
                present(
                    new ComponentWithProperties(SGVOldMembersView, {
                        members: oldMembers,
                        onCancel: () => {
                            if (resolved) {
                                return;
                            }
                            resolved = true;
                            reject(
                                new SimpleError({
                                    code: '',
                                    message: 'Synchronisatie geannuleerd',
                                }),
                            );
                        },
                        setAction: (
                            action: SGVOldMemberAction,
                        ) => {
                            if (resolved) {
                                return;
                            }
                            resolved = true;
                            try {
                                resolve({ oldMembers, action });
                            } catch (e) {
                                reject(e);
                            }
                        },
                    }).setDisplayStyle('popup'),
                ).catch(reject);
            });
        }

        return {
            oldMembers,
            action: SGVOldMemberAction.Nothing,
        };
    }

    async sync(
        report: SGVSyncReport,
        matched: SGVLidMatch[],
        newMembers: MemberWithRegistrationsBlob[],
        oldMembers: SGVLid[],
        action: SGVOldMemberAction,
        organization: Organization,
        onStatusChange?: (status: string, progress: number) => void,
    ): Promise<void> {
        let progress = 0;
        const total
            = (action !== SGVOldMemberAction.Nothing ? oldMembers.length : 0)
                + matched.length
                + newMembers.length;

        const deletedMembers: SGVLid[] = [];

        if (action === SGVOldMemberAction.Delete) {
            deletedMembers.push(...oldMembers);
            for (const mem of oldMembers) {
                if (onStatusChange) {
                    onStatusChange(
                        mem.firstName + ' ' + mem.lastName + ' schrappen...',
                        progress / total,
                    );
                    progress++;
                }

                try {
                    await this.schrapLid(mem);
                    report.markDeleted(mem);
                } catch (e) {
                    report.addError(new SGVMemberError(mem, e as Error));
                }
            }
        }

        // Start creating
        for (const member of newMembers) {
            try {
                if (onStatusChange) {
                    onStatusChange(
                        member.details!.firstName
                        + ' '
                        + member.details!.lastName
                        + ' toevoegen...',
                        progress / total,
                    );
                    progress++;
                }
                const lid = await this.createLid(member, report);
                report.markCreated(member, lid);
            } catch (e) {
                report.addError(new SGVMemberError(member, e as Error));
            }
        }

        matched.sort((a, b) =>
            Sorter.byDateValue(
                b.stamhoofd.details?.lastExternalSync ?? new Date(1900, 0, 1),
                a.stamhoofd.details?.lastExternalSync ?? new Date(1900, 0, 1),
            ),
        );

        // Start syncing...
        for (const match of matched) {
            try {
                // If updatedAt close to lastsynced at (5 seconds)
                if (match.stamhoofd.getSGVSyncStatus({
                    periodId: organization.period.period.id,
                }) === SGVSyncStatus.Ok) {
                    // report.addWarning(match.stamhoofd.details.firstName+" "+match.stamhoofd.details.lastName+" werd overgeslagen: geen wijzigingen sinds laatste synchronisatie");
                    report.markSkipped(match.stamhoofd);
                    continue;
                }
                if (onStatusChange) {
                    onStatusChange(
                        match.stamhoofd.details!.firstName
                        + ' '
                        + match.stamhoofd.details!.lastName
                        + ' aanpassen...',
                        progress / total,
                    );
                    progress++;
                }
                const lid = await this.syncLid(match, report);
                report.markSynced(match.stamhoofd, lid);
            } catch (e) {
                report.addError(new SGVMemberError(match.stamhoofd, e as Error));
            }
        }
    }

    async schrapLid(lid: SGVLid): Promise<void> {
        // Fetch full member from SGV
        const response = await this.tryRequest<SGVLidGet>({
            method: 'GET',
            path: '/lid/' + lid.id,
        });

        const lidData = response.data;
        const patch = schrappen(lidData, this.functies);

        await sleep(200);

        try {
            await this.tryRequest<SGVLidBevestig>({
                method: 'PATCH',
                path: '/lid/' + lid.id + '?bevestig=true',
                body: patch,
            });
        } catch (e) {
            console.error(e);
            throw e;
        }

        await sleep(200);
    }

    async fetchLid(sgvId: string): Promise<SGVLidGet> {
        // Fetch full member from SGV
        const response = await this.tryRequest<SGVLidGet>({
            method: 'GET',
            path: '/lid/' + sgvId,
        });
        await sleep(200);

        return response.data;
    }

    private unknownErrorMessage
        = 'De groepsadministratie van Scouts en Gidsen Vlaanderen gaf een foutmelding. Kijk ook even na of er geen rare of foutieve gegevens staan ingesteld bij dit lid in Stamhoofd of in de groepsadministratie zelf (bv. onbestaand adres, dubbele ouders, fout geschreven straatnaam, ontbrekende spatie in straat, ...). Zoek het adres van het lid (en ouders) op in Google Maps en corrigeer indien nodig. Pas de gegevens aan in Stamhoofd en probeer opnieuw te synchroniseren. Vind je de oorzaak niet? Mogelijks zit er een fout in de groepsadministratie, neem dan contact met ons op via hallo@stamhoofd.be.';

    async tryRequest<T>(
        request: RequestInitializer<T>,
    ): Promise<RequestResult<T>> {
        try {
            return await this.authenticatedServer.request({
                ...request,
                timeout: 30_000,
            });
        } catch (e) {
            if (Request.isTimeout(e)) {
                await this.reportIssue(
                    SGVReportIssue.create({
                        method: request.method,
                        path: request.path,
                        query: request.query,
                        body: request.body,
                        error: 'Timeout after 30 seconds',
                    }),
                );

                throw new SimpleError({
                    code: 'sgv_timeout',
                    message:
                        'De groepsadministratie van Scouts en Gidsen Vlaanderen reageerde niet binnen 30 seconden. Mogelijks is Scouts en Gidsen Vlaanderen even onbereikbaar of heb je een onstabiele internetverbinding. Probeer het later opnieuw.',
                });
            }

            if (!Request.isNetworkError(e)) {
                await this.reportIssue(
                    SGVReportIssue.create({
                        method: request.method,
                        path: request.path,
                        query: request.query,
                        body: request.body,
                        error: this.getErrorMessage(e),
                    }),
                );
            }

            if (
                e instanceof SyntaxError
                && (/Unexpected token/.test(e.message)
                    || /Unrecognized token/.test(e.message))
            ) {
                console.log(
                    'This error came from JSON.parse due to invalid syntax.',
                );

                throw new SimpleError({
                    code: 'sgv_internal_error',
                    message: this.unknownErrorMessage,
                });
            }

            throw e;
        }
    }

    async reportIssue(issue: SGVReportIssue) {
        try {
            await this.context.authenticatedServer.request({
                method: 'POST',
                path: '/sgv/report-issue',
                body: issue,
            });
        } catch (e) {
            console.error('Failed to report issue', issue, e);
        }
    }

    getErrorMessage(error: unknown): string {
        if (typeof error === 'string') {
            return error;
        }
        if (error === null || typeof error !== 'object') {
            return 'Er is een onbekende fout opgetreden';
        }

        if (error instanceof SGVMemberError) {
            return this.getErrorMessage(error.error);
        }

        if (Request.isNetworkError(error)) {
            return 'De groepsadministratie reageerde niet. Kijk ook even na of er geen rare of foute gegevens staan ingesteld bij dit lid in Stamhoofd of in de groepsadministratie zelf (bv. onbestaand adres, dubbele ouders, lege velden...). Pas de gegevens aan en probeer daarna opnieuw te synchroniseren. Vind je de oorzaak niet? Mogelijks zit er een fout in de groepsadministratie, neem dan contact met ons op via hallo@stamhoofd.be.';
        }
        if (!isSimpleError(error) && !isSimpleErrors(error)) {
            if ('message' in error && typeof error.message === 'string') {
                if (
                    error.message.startsWith('<!DOCTYPE')
                    || error.message.startsWith('<html')
                    || error.message.length > 1000
                ) {
                    return this.unknownErrorMessage;
                }

                return error.message;
            }
            return 'Er is een onleesbare fout opgetreden';
        }
        return error.message;
    }

    async syncLid(match: SGVLidMatch, report: SGVSyncReport) {
        let doAnotherPatch = true;
        let patchCount = 0;
        let lid;
        let shouldMarkExternalSync = true;
        let withHacks = false;

        while (doAnotherPatch) {
            patchCount++;
            if (patchCount > 5) {
                console.warn('Too many patches, breaking', lid);
                shouldMarkExternalSync = false;
                break;
            }
            lid = await this.fetchLid(match.sgvId);

            const { patch, needsMultiplePatches } = getPatch(
                match.stamhoofd,
                lid,
                this.groupNumber!,
                match.stamhoofd.getGroups(
                    this.organizationManager.organization,
                ),
                this.functies,
                report,
                withHacks,
            );
            doAnotherPatch = needsMultiplePatches;

            if (patch.adressen && patch.adressen.length === 0) {
                throw new SimpleError({
                    code: '',
                    message:
                        'Je moet minstens één adres toevoegen bij dit lid. Voeg een adres toe in Stamhoofd en probeer daarna opnieuw te synchroniseren.',
                });
            }

            try {
                const updateResponse = await this.tryRequest<SGVLidBevestig>({
                    method: 'PATCH',
                    path: '/lid/' + match.sgvId + '?bevestig=true',
                    body: patch,
                });
                match.stamhoofd.details.memberNumber
                    = updateResponse.data.verbondsgegevens.lidnummer ?? null;

                lid = updateResponse.data;
            } catch (e) {
                // todo: retry with hackss if is
                if (
                    isSimpleError(e)
                    && e.hasCode('sgv_internal_error')
                    && withHacks == false
                    && patchCount <= 2
                ) {
                    withHacks = true;
                    doAnotherPatch = true;
                    continue;
                }
                console.error(e);
                throw e;
            }
        }

        try {
            // Mark as synced in Stamhoofd
            if (shouldMarkExternalSync) {
                match.stamhoofd.details.lastExternalSync = new Date();
            }
            await this.patchMembersDetails(match.stamhoofd);
        } catch (e) {
            console.error(e);
            throw e;
        }

        await sleep(200);

        return lid;
    }

    /**
     * Create a new one in SGV
     */
    async createLid(
        member: MemberWithRegistrationsBlob,
        report: SGVSyncReport,
    ) {
        const { patch: post, needsMultiplePatches } = getPatch(
            member,
            {
                adressen: [],
                contacten: [],
                functies: [],
            },
            this.groupNumber!,
            member.getGroups(this.organizationManager.organization),
            this.functies,
            report,
        );
        let patchAfter = needsMultiplePatches;

        if (!post.adressen || post.adressen.length === 0) {
            throw new SimpleError({
                code: '',
                message:
                    'Je moet minstens één adres toevoegen bij dit lid. Voeg een adres toe in Stamhoofd en probeer daarna opnieuw te synchroniseren.',
            });
        }

        let lid: any;

        await sleep(100);

        try {
            if (post.functies && post.functies.length > 1) {
                // SGV doesn't support adding multiple functies in one go for new members (...)
                post.functies = [post.functies[0]];
                const updateResponse = await this.tryRequest<SGVLid>({
                    method: 'POST',
                    path: '/lid?bevestig=true',
                    body: post,
                });

                lid = updateResponse.data;

                // Do a patch for the remaining functies
                patchAfter = true;
            } else {
                const updateResponse = await this.tryRequest<SGVLidBevestig>({
                    method: 'POST',
                    path: '/lid?bevestig=true',
                    body: post,
                });

                lid = updateResponse.data;

                // Mark as synced in Stamhoofd
                member.details.memberNumber
                    = lid.verbondsgegevens?.lidnummer ?? null;
                member.details.lastExternalSync = new Date();
                await this.patchMembersDetails(member);

                lid = updateResponse.data;
            }

            if (patchAfter) {
                // Do another patch to set everything correctly
                lid = await this.syncLid(
                    {
                        stamhoofd: member,
                        sgvId: lid.id,
                    },
                    report,
                );
            }
        } catch (e) {
            console.error(e);
            throw e;
        }

        await sleep(100);
        return lid;
    }

    get server(): Server {
        return new Server(this.base);
    }

    get base(): string {
        return STAMHOOFD.domains.sgvAdminUrl as string;
    }

    get authenticatedServer() {
        const server = this.server;
        server.middlewares.push(this);
        return server;
    }

    // -- Implementation for requestMiddleware ----

    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (!this.oauth.hasToken) {
            // Euhm? The user is not signed in!
            throw new Error('Could not authenticate request without token');
        }

        await this.oauth.refreshToken();

        // request.overrideXMLHttpRequest = AppManager.shared.overrideXMLHttpRequest
        request.errorDecoder = new SGVFoutenDecoder();
        request.headers['Authorization']
            = 'Bearer ' + this.oauth.token.accessToken;
        request.headers['Accept'] = 'application/json';

        // The server is a bit buggy, so always parse as JSON
        request.responseContentTypeOverride = 'application/json';
    }

    async patchMembersDetails(member: Member): Promise<void> {
        const patches = new PatchableArray() as PatchableArrayAutoEncoder<MemberWithRegistrationsBlob>;

        patches.addPatch(MemberWithRegistrationsBlob.patch({
            id: member.id,
            details: MemberDetails.patch({
                memberNumber: member.details.memberNumber,
                lastExternalSync: member.details.lastExternalSync,
            }),
        }));

        // TODO DeepSet, of misschien PlatformMemberManager

        await this.context.authenticatedServer.request<MembersBlob>({
            method: 'PATCH',
            path: '/organization/members',
            body: patches,
        });
    }
}
