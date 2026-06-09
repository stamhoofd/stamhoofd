import type { Decoder } from "@simonbackx/simple-encoding";
import { PatchableArray } from "@simonbackx/simple-encoding";
import {
    isSimpleError,
    isSimpleErrors,
    SimpleError,
} from "@simonbackx/simple-errors";
import type {
    RequestInitializer,
    RequestMiddleware,
    RequestResult,
} from "@simonbackx/simple-networking";
import { Request, Server } from "@simonbackx/simple-networking";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import type { NavigationActions } from "@stamhoofd/components/types/NavigationActions";
import {
    defaultSGVFunctions,
    defaultSGVGroupNumber,
    SGV_FUNCTION_PATH,
    SGV_GROUP_PATH,
    SGVErrorsDecoder,
    SGV_LOGIN_AUTHORIZE_PATH,
    SGV_LOGIN_TOKEN_PATH,
    SGV_MEMBER_LIST_FILTER_PATH,
    SGV_MEMBER_LIST_PATH,
    SGV_MEMBER_PATH,
    SGV_PROFILE_PATH,
    SGV_SEARCH_SIMILAR_PATH,
    sgvMemberPath,
} from "@stamhoofd/sgv";
import type {
    SGVFunction,
    SGVGroup,
    SGVMember,
    SGVMemberFunction,
    SGVMemberPatch,
    SGVMemberSummary,
    SGVSearchMember,
} from "@stamhoofd/sgv";
import type {
    MemberManager,
    OrganizationManager,
    SessionContext,
} from "@stamhoofd/networking";
import { sleep } from "@stamhoofd/networking";
import { Storage } from "@stamhoofd/networking/Storage";
import { Formatter, StringCompare } from "@stamhoofd/utility";
import type { Organization } from "@stamhoofd/structures";
import type { Address, Group, Parent } from "@stamhoofd/structures";
import {
    ExternalSyncData,
    Gender,
    LimitedFilteredRequest,
    MemberDetails,
    MembersBlob,
    MemberWithRegistrationsBlob,
    PaginatedResponseDecoder,
    ParentType,
    SortItemDirection,
    GroupType,
} from "@stamhoofd/structures";
import SGVOldMembersView from "../views/dashboard/sgv/SGVOldMembersView.vue";
import SGVVerifyProbablyEqualView from "../views/dashboard/sgv/SGVVerifyProbablyEqualView.vue";
import {
    SGV_OAUTH_SAVED_REDIRECT_URL_STORAGE_KEY,
    SGV_OAUTH_SAVED_STATE_STORAGE_KEY,
} from "./SGVOAuthStorage";

enum SGVFunctionCode {
    Kapoenen = "KAP",
    KaboutersWelpen = "KW",
    JonggidsenJongverkenners = "JGJV",
    GidsenVerkenners = "GVE",
    Akabe = "AKAB",
    Jin = "JIN",
}

export type SGVMemberListItem = {
    id: string;
    firstName: string;
    lastName: string;
    memberNumber: string;
    birthDay: Date;
};

export enum SGVOldMemberAction {
    Delete = "delete",
    Nothing = "nothing",
}

export type SGVMemberMatch = {
    member: MemberWithRegistrationsBlob;
    sgvId: string;
};

export type SGVMemberMatchVerify = {
    member: MemberWithRegistrationsBlob;
    sgv: SGVMemberListItem | SGVSearchMember;
    verify: boolean;
};

/** Wraps a sync failure together with the member that caused it so reports can show actionable context. */
export class SGVMemberError extends Error {
    member: MemberWithRegistrationsBlob | SGVMemberListItem;
    error: Error;

    constructor(
        member: MemberWithRegistrationsBlob | SGVMemberListItem,
        error: Error,
    ) {
        super(error.message);
        this.member = member;
        this.error = error;
    }
}

/** Collects all outcomes of one SGV sync run for the final report and metadata update. */
export class SGVSyncReport {
    warnings: string[] = [];
    errors: Error[] = [];
    info: string[] = [];
    unmanagedInStamhoofd: {
        member: MemberWithRegistrationsBlob;
        sgvMember: SGVMember;
    }[] = [];
    unmanagedMissingInStamhoofd: SGVMember[] = [];
    created: { member: MemberWithRegistrationsBlob; sgvMember: SGVMember }[] =
        [];
    synced: { member: MemberWithRegistrationsBlob; sgvMember: SGVMember }[] =
        [];
    deleted: SGVMemberListItem[] = [];
    skipped: MemberWithRegistrationsBlob[] = [];

    addInfo(text: string) {
        this.info.push(text);
    }

    addError(error: Error) {
        this.errors.push(error);
    }

    markCreated(member: MemberWithRegistrationsBlob, sgvMember: SGVMember) {
        this.created.push({ member, sgvMember });
    }

    markSynced(member: MemberWithRegistrationsBlob, sgvMember: SGVMember) {
        this.synced.push({ member, sgvMember });
    }

    markSkipped(member: MemberWithRegistrationsBlob) {
        this.skipped.push(member);
    }

    markDeleted(member: SGVMemberListItem) {
        this.deleted.push(member);
    }

    markUnmanaged(member: MemberWithRegistrationsBlob, sgvMember: SGVMember) {
        this.unmanagedInStamhoofd.push({ member, sgvMember });
    }

    markUnmanagedMissing(lid: SGVMember) {
        this.unmanagedMissingInStamhoofd.push(lid);
    }
}

/** Coordinates SGV OAuth, member matching, patch generation, and synchronization from Stamhoofd to SGV. */
export class SGVGroupAdministration implements RequestMiddleware {
    token: {
        accessToken: string;
        refreshToken: string;
        validUntil: Date;
    } | null = null;
    members: SGVMemberListItem[] = [];
    groupNumber: string | null = null;
    group: SGVGroup | null = null;
    functions: SGVFunction[] = [];

    constructor(
        private readonly context: SessionContext,
        private readonly organizationManager: OrganizationManager,
        private readonly memberManager: MemberManager,
    ) {}

    get hasToken() {
        return !!this.token;
    }

    /** Starts the SGV OAuth flow and stores enough state to validate the callback and resume the current page. */
    async login() {
        const state = randomState();
        const redirectUri = this.redirectUri;
        await Storage.keyValue.setItem(
            SGV_OAUTH_SAVED_STATE_STORAGE_KEY,
            state,
        );
        await Storage.keyValue.setItem(
            SGV_OAUTH_SAVED_REDIRECT_URL_STORAGE_KEY,
            window.location.pathname,
        );

        const url = `${this.loginBase}${SGV_LOGIN_AUTHORIZE_PATH}?client_id=${encodeURIComponent(this.clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&response_mode=query&response_type=code&scope=openid`;
        window.location.href = url;
    }

    async getToken(code: string) {
        const response: RequestResult<any> = await this.loginServer.request({
            method: "POST",
            path: SGV_LOGIN_TOKEN_PATH,
            body: {
                client_id: this.clientId,
                code,
                grant_type: "authorization_code",
                redirect_uri: this.redirectUri,
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
        });

        this.token = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            validUntil: new Date(
                Date.now() + response.data.expires_in * 1000 - 10 * 1000,
            ),
        };
    }

    /** Refreshes the SGV access token before authenticated requests and converts auth failures to a user-facing logout error. */
    async refreshToken() {
        if (!this.token) {
            throw new SimpleError({
                code: "sgv_logged_out",
                message: "SGV token missing",
                human: $t(
                    "Je bent uitgelogd bij de groepsadministratie. Log opnieuw in en probeer opnieuw.",
                ),
            });
        }

        try {
            const response: RequestResult<any> = await this.loginServer.request(
                {
                    method: "POST",
                    path: SGV_LOGIN_TOKEN_PATH,
                    body: {
                        client_id: this.clientId,
                        refresh_token: this.token.refreshToken,
                        grant_type: "refresh_token",
                        redirect_uri: this.redirectUri,
                    },
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "application/json",
                    },
                },
            );

            this.token = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                validUntil: new Date(
                    Date.now() + response.data.expires_in * 1000 - 10 * 1000,
                ),
            };
        } catch (error) {
            console.error("Failed to refresh SGV token", error);
            throw new SimpleError({
                code: "sgv_refresh_failed",
                message: "SGV token refresh failed",
                human: $t(
                    "Je bent uitgelogd bij de groepsadministratie. Log opnieuw in en probeer opnieuw.",
                ),
            });
        }
    }

    /** Loads the SGV group context, validates available functions, applies the managed-member filter, and downloads current members. */
    async downloadAll() {
        await this.setGroupIfNeeded();
        await this.checkFunctions();
        await this.setManagedFilter();
        this.members = await this.downloadWithCurrentFilter();
    }

    /** Selects the SGV group that belongs to this organization and prevents syncing with a different stored group number. */
    async setGroupIfNeeded() {
        if (this.groupNumber) {
            return;
        }
        const groups = await this.getGroup();
        if (groups.length === 0) {
            throw new SimpleError({
                code: "missing_sgv_group",
                message: "No SGV group found",
                human: $t(
                    "We konden jouw scoutsgroep niet vinden in de groepsadministratie.",
                ),
            });
        }

        const storedGroupNumber =
            this.organization.privateMeta?.externalGroupNumber ?? null;
        if (storedGroupNumber) {
            const storedGroup = groups.find(
                (group) => group.groepsnummer === storedGroupNumber,
            );
            if (!storedGroup) {
                throw new SimpleError({
                    code: "sgv_group_mismatch",
                    message:
                        "SGV account does not have access to stored group number",
                    human: $t(
                        "Dit account hoort bij een andere scoutsgroep dan de groep die eerder met Stamhoofd werd gesynchroniseerd. Log in met het juiste account en probeer opnieuw.",
                    ),
                });
            }
            this.group = storedGroup;
            this.groupNumber = storedGroup.groepsnummer;
            return;
        }

        const possible = this.getPossibleGroups(groups);
        if (possible.length === 1) {
            this.group = possible[0];
        } else if (possible.length > 1) {
            throw new SimpleError({
                code: "multiple_sgv_groups",
                message: "Multiple matching SGV groups found",
                human: $t(
                    "We vonden meerdere scoutsgroepen die overeenkomen met deze organisatie. Daardoor kunnen we niet veilig bepalen met welke groep we moeten synchroniseren.",
                ),
            });
        } else if (groups.length === 1) {
            this.group = groups[0];
        } else {
            throw new SimpleError({
                code: "multiple_sgv_groups",
                message: "Multiple SGV groups found",
                human: $t(
                    "Dit account heeft toegang tot meerdere scoutsgroepen. Daardoor kunnen we niet veilig bepalen met welke groep we moeten synchroniseren.",
                ),
            });
        }

        this.groupNumber = this.group.groepsnummer;
        if (!this.groupNumber) {
            throw new SimpleError({
                code: "missing_group_number",
                message: "Missing SGV group number",
                human: $t("We konden het groepsnummer niet achterhalen."),
            });
        }
    }

    async getGroup(): Promise<SGVGroup[]> {
        const response = await this.tryRequest<any>({
            method: "GET",
            path: SGV_GROUP_PATH,
        });
        return (response.data.groepen ?? []) as SGVGroup[];
    }

    getPossibleGroups(groups: SGVGroup[]): SGVGroup[] {
        const organization = this.organization;
        return groups.filter((group) => {
            if (
                Formatter.slug(group.naam) === Formatter.slug(organization.name)
            ) {
                return true;
            }
            return group.adressen.some(
                (adres) =>
                    Formatter.slug(adres.straat) ===
                        Formatter.slug(organization.address.street) &&
                    Formatter.slug(adres.postcode) ===
                        Formatter.slug(organization.address.postalCode),
            );
        });
    }

    async checkFunctions() {
        const profile = await this.tryRequest<any>({
            method: "GET",
            path: SGV_PROFILE_PATH,
        });
        const hasAccess = (profile.data.functies ?? []).some(
            (f: any) =>
                (f.code === "VGA" || f.code === "AVGA") &&
                !f.einde &&
                f.groep === this.groupNumber,
        );
        if (!hasAccess) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Missing SGV VGA permission",
                human: $t(
                    "Je kan enkel synchroniseren met een account dat VGA of AVGA is.",
                ),
            });
        }
        await this.getFunctions();
    }

    async getFunctions() {
        const response = await this.tryRequest<any>({
            method: "GET",
            path: SGV_FUNCTION_PATH,
            query: { groep: this.groupNumber },
        });
        this.functions = [
            ...defaultSGVFunctions,
            ...(response.data.functies ?? []),
        ];
        if (
            !this.functions.find(
                (f) => f.beschrijving === "Beheerd in Stamhoofd",
            )
        ) {
            const created = await this.tryRequest<any>({
                method: "POST",
                path: SGV_FUNCTION_PATH,
                body: {
                    beschrijving: "Beheerd in Stamhoofd",
                    groepen: [this.groupNumber],
                    type: "groepseigen",
                },
            });
            this.functions.push(created.data as SGVFunction);
        }
    }

    async setManagedFilter() {
        await this.tryRequest({
            method: "PATCH",
            path: SGV_MEMBER_LIST_FILTER_PATH,
            responseType: "text",
            body: {
                criteria: {
                    functies: [],
                    groepen: [this.groupNumber],
                    oudleden: false,
                },
                kolommen: [
                    "be.vvksm.groepsadmin.model.column.LidNummerColumn",
                    "be.vvksm.groepsadmin.model.column.VoornaamColumn",
                    "be.vvksm.groepsadmin.model.column.AchternaamColumn",
                    "be.vvksm.groepsadmin.model.column.GeboorteDatumColumn",
                ],
                groepen: [],
                sortering: [
                    "be.vvksm.groepsadmin.model.column.LidNummerColumn",
                ],
                type: "lid",
            },
        });
    }

    async downloadWithCurrentFilter() {
        const members: SGVMemberListItem[] = [];
        let offset = 0;
        let total = 1;
        while (offset < total) {
            const response = await this.tryRequest<any>({
                method: "GET",
                path: SGV_MEMBER_LIST_PATH,
                query: { aantal: 100, offset },
            });
            members.push(...(response.data.leden ?? []).map(summaryToMember));
            offset = response.data.offset + response.data.aantal;
            total = response.data.totaal;
        }
        return members;
    }

    /** Matches Stamhoofd members with SGV members and asks the user to resolve probable matches before creating new members. */
    async matchAndSync(
        navigationActions: NavigationActions,
        onPopup: () => void,
    ): Promise<{
        matchedMembers: SGVMemberMatch[];
        newMembers: MemberWithRegistrationsBlob[];
    }> {
        // Legacy synced all Stamhoofd members in the organization, even when launched from a group page.
        // TODO: consider scoping this to the selected group once old-member deletion semantics are made safe.
        const allMembers = (await this.loadOrganizationMembers()).filter(
            (member) => this.shouldSyncMember(member),
        );
        const matchedMembers: SGVMemberMatch[] = [];
        let newMembers: MemberWithRegistrationsBlob[] = [];
        const probablyEqualList: SGVMemberMatchVerify[] = [];

        for (const member of allMembers) {
            const exact = this.members.find((lid) =>
                memberIsEqual(lid, member),
            );
            if (exact) {
                matchedMembers.push({ member: member, sgvId: exact.id });
                continue;
            }
            const similar = await this.searchSimilar(member);
            if (similar) {
                if (searchMemberIsEqual(similar, member)) {
                    matchedMembers.push({ member: member, sgvId: similar.id });
                } else {
                    probablyEqualList.push({
                        member: member,
                        sgv: similar,
                        verify: searchMemberIsProbablyEqual(similar, member),
                    });
                }
                continue;
            }
            newMembers.push(member);
        }

        newMembers = newMembers.filter((member) => {
            const probable = this.members.find((lid) =>
                memberIsProbablyEqual(lid, member),
            );
            if (probable) {
                probablyEqualList.push({
                    member: member,
                    sgv: probable,
                    verify: true,
                });
                return false;
            }
            const lastResort = this.members.find((lid) =>
                memberIsProbablyEqualLastResort(lid, member),
            );
            if (lastResort) {
                probablyEqualList.push({
                    member: member,
                    sgv: lastResort,
                    verify: false,
                });
                return false;
            }
            return true;
        });

        if (probablyEqualList.length > 0) {
            onPopup();
            await new Promise<void>((resolve, reject) => {
                navigationActions
                    .present({
                        components: [
                            new ComponentWithProperties(
                                SGVVerifyProbablyEqualView,
                                {
                                    matches: probablyEqualList,
                                    onCancel: () =>
                                        reject(
                                            new SimpleError({
                                                code: "cancelled",
                                                message: "SGV sync cancelled",
                                                human: $t(
                                                    "Synchronisatie geannuleerd",
                                                ),
                                            }),
                                        ),
                                    onVerified: (
                                        verified: SGVMemberMatchVerify[],
                                    ) => {
                                        for (const item of verified) {
                                            if (item.verify) {
                                                matchedMembers.push({
                                                    member: item.member,
                                                    sgvId: item.sgv.id,
                                                });
                                            } else {
                                                newMembers.push(item.member);
                                            }
                                        }
                                        resolve();
                                    },
                                },
                            ),
                        ],
                        modalDisplayStyle: "popup",
                    })
                    .catch(reject);
            });
        }

        return { matchedMembers, newMembers };
    }

    /** Returns whether the member has an active registration in the current period and should be managed in SGV. */
    shouldSyncMember(member: MemberWithRegistrationsBlob): boolean {
        const periodId = this.organizationManager.organization.period.period.id;
        return member.registrations.some(
            (registration) =>
                registration.registeredAt !== null &&
                registration.deactivatedAt === null &&
                registration.group.type !== GroupType.WaitingList &&
                registration.group.periodId === periodId,
        );
    }

    /** Finds SGV-managed members that no longer exist in Stamhoofd and asks whether their active SGV functions should end. */
    async prepareSync(
        navigationActions: NavigationActions,
        report: SGVSyncReport,
        matched: SGVMemberMatch[],
    ): Promise<{
        oldMembers: SGVMemberListItem[];
        action: SGVOldMemberAction;
    }> {
        const oldMembers: SGVMemberListItem[] = [];
        for (const member of this.members) {
            if (!matched.find((m) => m.sgvId === member.id)) {
                const lid = await this.fetchMember(member.id);
                if (isManaged(lid, this.functions)) {
                    oldMembers.push(member);
                } else {
                    report.markUnmanagedMissing(lid);
                }
            }
        }
        if (oldMembers.length === 0) {
            return { oldMembers, action: SGVOldMemberAction.Nothing };
        }
        return await new Promise((resolve, reject) => {
            navigationActions
                .present({
                    components: [
                        new ComponentWithProperties(SGVOldMembersView, {
                            members: oldMembers,
                            onCancel: () =>
                                reject(
                                    new SimpleError({
                                        code: "cancelled",
                                        message: "SGV sync cancelled",
                                        human: $t("Synchronisatie geannuleerd"),
                                    }),
                                ),
                            setAction: (action: SGVOldMemberAction) =>
                                resolve({ oldMembers, action }),
                        }),
                    ],
                    modalDisplayStyle: "popup",
                })
                .catch(reject);
        });
    }

    /** Executes the chosen sync actions and records per-member failures without aborting the remaining sync. */
    async sync(
        report: SGVSyncReport,
        matched: SGVMemberMatch[],
        newMembers: MemberWithRegistrationsBlob[],
        oldMembers: SGVMemberListItem[],
        action: SGVOldMemberAction,
        onStatusChange?: (status: string, progress: number) => void,
    ) {
        let progress = 0;
        const total =
            (action !== SGVOldMemberAction.Nothing ? oldMembers.length : 0) +
            matched.length +
            newMembers.length;
        const next = (status: string) => {
            onStatusChange?.(status, total === 0 ? 1 : progress / total);
            progress++;
        };

        if (action === SGVOldMemberAction.Delete) {
            for (const member of oldMembers) {
                next(`${member.firstName} ${member.lastName} schrappen...`);
                try {
                    await this.deleteSGVMember(member);
                    report.markDeleted(member);
                } catch (error) {
                    report.addError(new SGVMemberError(member, error as Error));
                }
            }
        }

        for (const member of newMembers) {
            next(`${member.details.name} toevoegen...`);
            try {
                const lid = await this.createSGVMember(member, report);
                report.markCreated(member, lid);
            } catch (error) {
                report.addError(new SGVMemberError(member, error as Error));
            }
        }

        for (const match of matched) {
            if (
                match.member.details.lastExternalSync &&
                match.member.updatedAt <= match.member.details.lastExternalSync
            ) {
                report.markSkipped(match.member);
                continue;
            }
            next(`${match.member.details.name} aanpassen...`);
            try {
                const lid = await this.syncSGVMember(match, report);
                report.markSynced(match.member, lid);
            } catch (error) {
                report.addError(
                    new SGVMemberError(match.member, error as Error),
                );
            }
        }
    }

    /** Builds organization sync metadata only after a fully successful run so warning badges reflect trusted SGV counts. */
    createExternalSyncData(
        report: SGVSyncReport,
        current: ExternalSyncData | null,
    ): ExternalSyncData | null {
        if (report.errors.length > 0) {
            return current;
        }

        const counts = new Map<string, number>();
        const addCount = (sgvFunction: SGVMemberFunction) => {
            if (sgvFunction.einde) {
                return;
            }

            const code =
                sgvFunction.omschrijving ||
                sgvFunction.code ||
                this.functions.find((f) => f.id === sgvFunction.functie)
                    ?.beschrijving ||
                this.functions.find((f) => f.id === sgvFunction.functie)
                    ?.code ||
                "Onbekende functie";
            counts.set(code, (counts.get(code) ?? 0) + 1);
        };

        for (const item of [...report.created, ...report.synced]) {
            for (const sgvFunction of item.sgvMember.functies ?? []) {
                addCount(sgvFunction);
            }
        }

        for (const member of report.skipped) {
            try {
                const patch = this.getPatch(member, {
                    adressen: [],
                    contacten: [],
                    functies: [],
                });
                for (const sgvFunction of patch.functies ?? []) {
                    addCount(sgvFunction);
                }
            } catch (error) {
                // Ignore members that are not managed by Stamhoofd for the metadata summary.
            }
        }

        return ExternalSyncData.create({
            lastExternalSync: new Date(),
            lastDeleted:
                report.deleted.length > 0
                    ? new Date()
                    : (current?.lastDeleted ?? null),
            lastSyncedBy: this.syncedByName,
            counts,
        });
    }

    /** Searches SGV by name and returns the strongest candidate according to the same matching rules used for local lists. */
    async searchSimilar(
        member: MemberWithRegistrationsBlob,
    ): Promise<SGVSearchMember | undefined> {
        const response = await this.tryRequest<any>({
            method: "GET",
            path: SGV_SEARCH_SIMILAR_PATH,
            query: {
                voornaam: member.details.firstName,
                achternaam: member.details.lastName,
            },
        });
        const members = (response.data.leden ?? []) as SGVSearchMember[];
        return (
            members.find((sgvMember) =>
                searchMemberIsEqual(sgvMember, member),
            ) ??
            members.find((sgvMember) =>
                searchMemberIsProbablyEqual(sgvMember, member),
            ) ??
            members.find((sgvMember) =>
                searchMemberIsProbablyEqualLastResort(sgvMember, member),
            )
        );
    }

    async fetchMember(sgvId: string): Promise<SGVMember> {
        const response = await this.tryRequest<SGVMember>({
            method: "GET",
            path: sgvMemberPath(sgvId),
        });
        return response.data;
    }

    /** Creates a new SGV member from a Stamhoofd member and immediately stores the returned SGV member number locally. */
    async createSGVMember(
        member: MemberWithRegistrationsBlob,
        report: SGVSyncReport,
    ) {
        const response = await this.tryRequest<SGVMember>({
            method: "POST",
            path: `${SGV_MEMBER_PATH}?bevestig=true`,
            body: this.getPatch(
                member,
                { adressen: [], contacten: [], functies: [] },
                report,
            ) as any,
        });
        await this.markMemberSynced(member, response.data);
        await sleep(100);
        return response.data;
    }

    /** Fetches the latest SGV member, patches only Stamhoofd-managed fields, and updates local sync metadata. */
    async syncSGVMember(match: SGVMemberMatch, report: SGVSyncReport) {
        const lid = await this.fetchMember(match.sgvId);
        const patch = this.getPatch(match.member, lid, report);
        const response = await this.tryRequest<SGVMember>({
            method: "PATCH",
            path: `${sgvMemberPath(match.sgvId)}?bevestig=true`,
            body: patch as any,
        });
        await this.markMemberSynced(match.member, response.data);
        await sleep(100);
        return response.data;
    }

    /** Ends active SGV functions managed by Stamhoofd instead of deleting the external member record. */
    async deleteSGVMember(lid: SGVMemberListItem) {
        const data = await this.fetchMember(lid.id);
        const patch = createDeleteMemberPatch(data, this.functions);
        await this.tryRequest({
            method: "PATCH",
            path: `${sgvMemberPath(lid.id)}?bevestig=true`,
            body: patch as any,
        });
        await sleep(100);
    }

    /** Converts a Stamhoofd member into the SGV patch format while preserving SGV-owned fields and ended functions. */
    getPatch(
        member: MemberWithRegistrationsBlob,
        lid: Partial<SGVMember>,
        report?: SGVSyncReport,
    ): SGVMemberPatch {
        const details = member.details;
        if (!details.birthDay) {
            throw new SimpleError({
                code: "missing_birth_day",
                message: "Missing birth day",
                human: $t(
                    "Een geboortedatum is noodzakelijk voor de groepsadministratie.",
                ),
            });
        }

        const addresses = this.getAddresses(
            details.address,
            details.parents,
            lid.adressen ?? [],
            lid.contacten ?? [],
        );
        const contacts = this.getContacts(
            details.parents,
            addresses.addressMap,
            lid.contacten ?? [],
        );
        const memberFunction = this.getFunction(
            details,
            member.registrations.map((r) => r.group),
        );
        const stamhoofdFunction =
            this.functions.find(
                (f) => f.beschrijving === "Beheerd in Stamhoofd",
            ) ?? null;

        const functions: SGVMemberFunction[] = [];
        let functionAlreadyPresent = false;
        let stamhoofdFunctionAlreadyPresent = false;
        for (const sgvFunction of lid.functies ?? []) {
            if (
                sgvFunction.einde ||
                !this.isManagedFunction(sgvFunction.functie)
            ) {
                functions.push(sgvFunction);
                continue;
            }

            if (
                stamhoofdFunction &&
                sgvFunction.functie === stamhoofdFunction.id
            ) {
                stamhoofdFunctionAlreadyPresent = true;
                functions.push(sgvFunction);
                continue;
            }

            if (memberFunction && sgvFunction.functie === memberFunction.id) {
                functionAlreadyPresent = true;
                functions.push(sgvFunction);
                continue;
            }

            const { links, omschrijving, code, ...endedFunction } = sgvFunction;
            functions.push({
                ...endedFunction,
                einde: new Date().toISOString(),
            });
            const oldFunction = this.functions.find(
                (f) => f.id === sgvFunction.functie,
            );
            if (oldFunction) {
                report?.addInfo(
                    `${details.name}: functie verwijderd ${oldFunction.beschrijving}`,
                );
            }
        }

        if (memberFunction && !functionAlreadyPresent) {
            functions.push({
                groep: this.groupNumber ?? defaultSGVGroupNumber,
                functie: memberFunction.id,
                begin: new Date().toISOString(),
            });
            report?.addInfo(
                `${details.name}: functie toegekend ${memberFunction.beschrijving}`,
            );
        }

        if (stamhoofdFunction && !stamhoofdFunctionAlreadyPresent) {
            functions.push({
                groep: this.groupNumber ?? defaultSGVGroupNumber,
                functie: stamhoofdFunction.id,
                begin: new Date().toISOString(),
            });
        }

        if (!memberFunction) {
            report?.markUnmanaged(member, lid as SGVMember);
        }

        const patch: SGVMemberPatch = {
            persoonsgegevens: {
                ...(lid.persoonsgegevens ?? {}),
                geslacht:
                    details.gender === Gender.Male
                        ? "man"
                        : details.gender === Gender.Female
                          ? "vrouw"
                          : "andere",
                gsm: details.phone ?? "",
            },
            vgagegevens: {
                ...(lid.vgagegevens ?? {}),
                voornaam: details.firstName,
                achternaam: details.lastName,
                geboortedatum: Formatter.dateNumber(details.birthDay)
                    .split("/")
                    .reverse()
                    .join("-"),
                beperking: false,
                verminderdlidgeld:
                    details.requiresFinancialSupport?.value ?? false,
            },
            adressen: addresses.addresses,
            contacten: contacts,
            functies: functions,
        };

        const patchSections =
            lid.links?.find((l) => l.method === "PATCH")?.sections ?? [];
        if (patchSections.includes("email") && lid.email !== details.email) {
            patch.email = details.email ?? "";
        }

        return patch;
    }

    /** Chooses the SGV branch function from the member's group names first and age fallback second. */
    getFunction(details: MemberDetails, groups: Group[]): SGVFunction | null {
        const groupCode = getGroupFunctionCode(groups);
        const code = groupCode ?? getAgeFunctionCode(details);
        return code
            ? (this.functions.find((f) => f.code === code) ?? null)
            : null;
    }

    /** Builds deduplicated SGV addresses and maps Stamhoofd parent/member addresses to SGV ids for contacts. */
    getAddresses(
        memberAddress: Address | null,
        parents: Parent[],
        existingAddresses: SGVMember["adressen"],
        existingContacts: SGVMember["contacten"],
    ): { addresses: SGVMember["adressen"]; addressMap: Map<string, string> } {
        const addresses: SGVMember["adressen"] = [];
        const addressMap = new Map<string, string>();
        let hasPostAddress = false;

        const addAddress = (
            address: Address,
            index: number,
            preferPostAddress: boolean,
        ) => {
            const key = address.toString().toLowerCase();
            if (addressMap.has(key)) {
                return;
            }

            const sgvAddress = createOrUpdateAddress(
                address,
                existingAddresses,
                existingContacts,
                index,
            );
            addressMap.set(key, sgvAddress.id);
            if (addresses.some((a) => a.id === sgvAddress.id)) {
                return;
            }

            if (preferPostAddress && !hasPostAddress) {
                sgvAddress.postadres = true;
            }

            if (hasPostAddress) {
                sgvAddress.postadres = false;
            } else if (sgvAddress.postadres) {
                hasPostAddress = true;
            }

            addresses.push(sgvAddress);
        };

        parents.forEach((parent, index) => {
            if (!parent.address) {
                throw new SimpleError({
                    code: "missing_parent_address",
                    message: "Missing parent address",
                    human: $t("Er ontbreekt een adres bij een ouder."),
                });
            }
            addAddress(parent.address, index + 1, false);
        });

        if (memberAddress) {
            addAddress(memberAddress, 0, true);
        }

        if (!hasPostAddress && addresses.length > 0) {
            addresses[0].postadres = true;
        }

        return { addresses, addressMap };
    }

    /** Converts Stamhoofd parents to SGV contacts while reusing existing SGV contact ids when names still match. */
    getContacts(
        parents: Parent[],
        addressMap: Map<string, string>,
        existingContacts: SGVMember["contacten"],
    ): SGVMember["contacten"] {
        return parents.map((parent) => {
            const existing = existingContacts.find(
                (c) =>
                    StringCompare.typoCount(
                        parent.firstName,
                        c.voornaam ?? "",
                    ) <= 1 &&
                    StringCompare.typoCount(
                        parent.lastName,
                        c.achternaam ?? "",
                    ) <= 1,
            );
            return {
                ...(existing ?? {
                    id: `contact${Date.now()}${Math.floor(Math.random() * 100000)}`,
                }),
                adres: parent.address
                    ? addressMap.get(parent.address.toString().toLowerCase())
                    : undefined,
                voornaam: parent.firstName,
                achternaam: parent.lastName,
                gsm: parent.phone ?? "",
                email: parent.email ?? "",
                rol:
                    parent.type === ParentType.Father ||
                    parent.type === ParentType.Stepfather
                        ? "vader"
                        : parent.type === ParentType.Mother ||
                            parent.type === ParentType.Stepmother
                          ? "moeder"
                          : "voogd",
            };
        });
    }

    isManagedFunction(id: string) {
        return this.functions.some(
            (f) =>
                f.id === id &&
                (!!f.code || f.beschrijving === "Beheerd in Stamhoofd"),
        );
    }

    /** Stores the SGV member number and sync timestamp locally after SGV accepted a create or patch. */
    async markMemberSynced(
        member: MemberWithRegistrationsBlob,
        lid: SGVMember,
    ) {
        const arr = new PatchableArray() as any;
        arr.addPatch(
            MemberWithRegistrationsBlob.patch({
                id: member.id,
                details: MemberDetails.patch({
                    memberNumber:
                        lid.verbondsgegevens?.lidnummer ??
                        member.details.memberNumber,
                    lastExternalSync: new Date(),
                }),
            }),
        );
        const response = await this.context.authenticatedServer.request({
            method: "PATCH",
            path: "/organization/members",
            body: arr,
            decoder: MembersBlob as Decoder<MembersBlob>,
        });
        response.data.markReceivedFromBackend();
        this.memberManager.family.insertFromBlob(response.data, true);
        if (this.context.user) {
            this.context.user.members = response.data;
        }
    }

    async loadOrganizationMembers() {
        const response = await this.context.authenticatedServer.request({
            method: "GET",
            path: "/members",
            query: new LimitedFilteredRequest({
                limit: 1000,
                sort: [
                    { key: "firstName", order: SortItemDirection.ASC },
                    { key: "lastName", order: SortItemDirection.ASC },
                    { key: "id", order: SortItemDirection.ASC },
                ],
            }),
            decoder: new PaginatedResponseDecoder(
                MembersBlob as Decoder<MembersBlob>,
                LimitedFilteredRequest as Decoder<LimitedFilteredRequest>,
            ),
            shouldRetry: false,
        });
        const blob = response.data.results as MembersBlob;
        return blob.members;
    }

    /** Wraps SGV requests with user-friendly timeout/network/invalid-JSON errors while keeping decoded SGV errors intact. */
    async tryRequest<T>(
        request: RequestInitializer<T>,
    ): Promise<RequestResult<T>> {
        try {
            return await this.authenticatedServer.request({
                ...request,
                timeout: 30_000,
            });
        } catch (error) {
            if (Request.isTimeout(error)) {
                throw new SimpleError({
                    code: "sgv_timeout",
                    message: "SGV request timed out",
                    human: $t(
                        "De groepsadministratie van Scouts en Gidsen Vlaanderen reageerde niet binnen 30 seconden. Probeer het later opnieuw.",
                    ),
                });
            }

            if (Request.isNetworkError(error)) {
                throw new SimpleError({
                    code: "sgv_network_error",
                    message: "SGV network error",
                    human: $t(
                        "De groepsadministratie van Scouts en Gidsen Vlaanderen reageerde niet. Controleer je internetverbinding en probeer opnieuw.",
                    ),
                });
            }

            if (
                error instanceof SyntaxError &&
                (/Unexpected token/.test(error.message) ||
                    /Unrecognized token/.test(error.message))
            ) {
                throw new SimpleError({
                    code: "sgv_internal_error",
                    message: "SGV returned invalid JSON",
                    human: this.unknownErrorMessage,
                });
            }

            if (!isSimpleError(error) && !isSimpleErrors(error)) {
                console.error(
                    "SGV request failed",
                    request.method,
                    request.path,
                    this.getErrorMessage(error),
                );
            }
            throw error;
        }
    }

    /** Request middleware that refreshes tokens when needed and forces SGV responses through the SGV error decoder. */
    async onBeforeRequest(request: Request<any>): Promise<void> {
        if (!this.token) {
            throw new Error("Could not authenticate SGV request without token");
        }

        if (this.token.validUntil < new Date()) {
            await this.refreshToken();
        }

        request.errorDecoder = new SGVErrorsDecoder();
        request.headers.Authorization = `Bearer ${this.token.accessToken}`;
        request.headers.Accept = "application/json";
        if (request.responseType !== "text") {
            request.responseContentTypeOverride = "application/json";
        }
    }

    private readonly unknownErrorMessage = $t(
        "De groepsadministratie van Scouts en Gidsen Vlaanderen gaf een foutmelding. Kijk na of er geen foutieve gegevens staan ingesteld bij dit lid in Stamhoofd of in de groepsadministratie zelf, zoals een onbestaand adres, dubbele ouders of een fout geschreven straatnaam. Pas de gegevens aan en probeer opnieuw te synchroniseren.",
    );

    getErrorMessage(error: unknown): string {
        if (typeof error === "string") {
            return error;
        }
        if (error === null || typeof error !== "object") {
            return $t("Er is een onbekende fout opgetreden.");
        }
        if (error instanceof SGVMemberError) {
            return this.getErrorMessage(error.error);
        }
        if ("message" in error && typeof error.message === "string") {
            if (
                error.message.startsWith("<!DOCTYPE") ||
                error.message.startsWith("<html") ||
                error.message.length > 1000
            ) {
                return this.unknownErrorMessage;
            }
            return error.message;
        }
        return $t("Er is een onleesbare fout opgetreden.");
    }

    get loginServer() {
        return new Server(this.loginBase);
    }

    get authenticatedServer() {
        const server = new Server(this.adminBase);
        server.middlewares.push(this);
        return server;
    }

    get loginBase() {
        return STAMHOOFD.domains.sgvLoginUrl;
    }

    get adminBase() {
        return STAMHOOFD.domains.sgvAdminUrl;
    }

    get redirectUri() {
        return `${window.location.origin}/oauth/sgv`;
    }

    get organization(): Organization {
        return this.organizationManager.organization;
    }

    get syncedByName(): string | null {
        const user = this.context.user;
        if (!user) {
            return null;
        }
        return user.firstName
            ? `${user.firstName} ${user.lastName}`
            : user.email;
    }

    get clientId() {
        return "groep-O2209G-Prins-Boudewijn-Wetteren";
    }
}

function randomState(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
    );
}

function summaryToMember(member: SGVMemberSummary): SGVMemberListItem {
    const date =
        member.waarden["be.vvksm.groepsadmin.model.column.GeboorteDatumColumn"];
    const [day, month, year] = date
        .split("/")
        .map((v) => Number.parseInt(v, 10));
    return {
        id: member.id,
        firstName:
            member.waarden["be.vvksm.groepsadmin.model.column.VoornaamColumn"],
        lastName:
            member.waarden[
                "be.vvksm.groepsadmin.model.column.AchternaamColumn"
            ],
        memberNumber:
            member.waarden["be.vvksm.groepsadmin.model.column.LidNummerColumn"],
        birthDay: new Date(year, month - 1, day, 12),
    };
}

function memberIsEqual(
    lid: SGVMemberListItem,
    member: MemberWithRegistrationsBlob,
) {
    if (
        member.details.memberNumber &&
        lid.memberNumber &&
        member.details.memberNumber === lid.memberNumber
    )
        return true;
    return (
        !!member.details.birthDay &&
        StringCompare.typoCount(
            member.details.name,
            `${lid.firstName} ${lid.lastName}`,
        ) === 0 &&
        Formatter.dateNumber(member.details.birthDay) ===
            Formatter.dateNumber(lid.birthDay)
    );
}

function memberIsProbablyEqual(
    lid: SGVMemberListItem,
    member: MemberWithRegistrationsBlob,
) {
    if (!member.details.birthDay) return false;
    if (member.details.memberNumber && lid.memberNumber) {
        return member.details.memberNumber === lid.memberNumber;
    }
    const t = StringCompare.typoCount(
        member.details.name,
        `${lid.firstName} ${lid.lastName}`,
    );
    const y = StringCompare.typoCount(
        Formatter.dateNumber(member.details.birthDay),
        Formatter.dateNumber(lid.birthDay),
    );
    return (
        t + y <= 3 &&
        y <= 0 &&
        t <
            0.4 *
                Math.min(
                    lid.firstName.length + lid.lastName.length,
                    member.details.firstName.length +
                        member.details.lastName.length,
                )
    );
}

function memberIsProbablyEqualLastResort(
    lid: SGVMemberListItem,
    member: MemberWithRegistrationsBlob,
) {
    const t = StringCompare.typoCount(
        member.details.name,
        `${lid.firstName} ${lid.lastName}`,
    );
    return (
        t <= 2 &&
        t <
            0.4 *
                Math.min(
                    lid.firstName.length + lid.lastName.length,
                    member.details.firstName.length +
                        member.details.lastName.length,
                )
    );
}

function searchMemberIsEqual(
    lid: SGVSearchMember,
    member: MemberWithRegistrationsBlob,
) {
    if (!member.details.birthDay) return false;
    const birthDay = new Date(lid.geboortedatum + "T12:00:00");
    return (
        StringCompare.typoCount(
            member.details.name,
            `${lid.voornaam} ${lid.achternaam}`,
        ) === 0 &&
        Formatter.dateNumber(member.details.birthDay) ===
            Formatter.dateNumber(birthDay)
    );
}

function searchMemberIsProbablyEqual(
    lid: SGVSearchMember,
    member: MemberWithRegistrationsBlob,
) {
    if (!member.details.birthDay) return false;
    const birthDay = new Date(lid.geboortedatum + "T12:00:00");
    const t = StringCompare.typoCount(
        member.details.name,
        `${lid.voornaam} ${lid.achternaam}`,
    );
    const y = StringCompare.typoCount(
        Formatter.dateNumber(member.details.birthDay),
        Formatter.dateNumber(birthDay),
    );
    return (
        t + y <= 3 &&
        y <= 0 &&
        t <
            0.4 *
                Math.min(
                    lid.voornaam.length + lid.achternaam.length,
                    member.details.firstName.length +
                        member.details.lastName.length,
                )
    );
}

function searchMemberIsProbablyEqualLastResort(
    lid: SGVSearchMember,
    member: MemberWithRegistrationsBlob,
) {
    if (!member.details.birthDay) return false;
    const birthDay = new Date(lid.geboortedatum + "T12:00:00");
    const t = StringCompare.typoCount(
        member.details.name,
        `${lid.voornaam} ${lid.achternaam}`,
    );
    const y = StringCompare.typoCount(
        Formatter.dateNumber(member.details.birthDay),
        Formatter.dateNumber(birthDay),
    );
    return (
        t <= 2 &&
        y <= 2 &&
        t <
            0.4 *
                Math.min(
                    lid.voornaam.length + lid.achternaam.length,
                    member.details.firstName.length +
                        member.details.lastName.length,
                )
    );
}

function getGroupFunctionCode(groups: Group[]): SGVFunctionCode | null {
    const matches = new Set<SGVFunctionCode>();
    const allowedExactMatches: Record<SGVFunctionCode, string[]> = {
        [SGVFunctionCode.Kapoenen]: ["kapoenen"],
        [SGVFunctionCode.KaboutersWelpen]: ["kabouters", "welpen", "wouters"],
        [SGVFunctionCode.JonggidsenJongverkenners]: [
            "jonggidsen",
            "jongverkenners",
            "jonggivers",
            "jong-verkenners",
            "jong-givers",
            "jong-gidsen",
        ],
        [SGVFunctionCode.GidsenVerkenners]: ["gidsen", "verkenners", "givers"],
        [SGVFunctionCode.Akabe]: ["akabe"],
        [SGVFunctionCode.Jin]: ["jin", "jins"],
    };

    for (const [code, words] of Object.entries(allowedExactMatches)) {
        for (const word of words) {
            for (const group of groups) {
                const slug = Formatter.slug(
                    group.settings.name
                        .toString()
                        .replace(/\(.*?\)/g, "")
                        .replace(/\d+/g, ""),
                );
                if (StringCompare.typoCount(word, slug) === 0) {
                    matches.add(code as SGVFunctionCode);
                }
            }
        }
    }

    return matches.size === 1 ? [...matches][0] : null;
}

function getAgeFunctionCode(details: MemberDetails): SGVFunctionCode | null {
    if (!details.birthDay) {
        return null;
    }

    let scoutYear = new Date().getFullYear();
    if (new Date().getMonth() + 1 <= 8) {
        scoutYear -= 1;
    }

    const age = scoutYear - details.birthDay.getFullYear();
    if (age >= 5 && age <= 7) return SGVFunctionCode.Kapoenen;
    if (age >= 8 && age <= 10) return SGVFunctionCode.KaboutersWelpen;
    if (age >= 11 && age <= 13) return SGVFunctionCode.JonggidsenJongverkenners;
    if (age >= 14 && age <= 16) return SGVFunctionCode.GidsenVerkenners;
    if (age === 17) return SGVFunctionCode.Jin;
    return null;
}

function trimAddressPart(value: string) {
    return value.replace(/^[^a-zA-Z0-9]/, "").replace(/[^a-zA-Z0-9]$/, "");
}

/** Splits Belgian-style house number strings into SGV's separate number and bus fields. */
export function splitStreetNumber(houseNumber: string): {
    number: string;
    bus: string;
} {
    const cleaned = houseNumber.toUpperCase().replace(/[^0-9A-Z]+/g, " ");
    const parts = cleaned.split(" ");
    let str = "";

    for (let part of parts) {
        part = part.replace(/BUS/g, "");
        if (part.startsWith("B")) {
            part = part.substring(1);
        }
        while (part.substring(0, 1) === "0") {
            part = part.substring(1);
        }

        const startsDigit = /\d+/.test(part.substring(0, 1));
        if (str !== "" && startsDigit) {
            str += " ";
        }
        str += part;
    }

    const split = str.split(" ");
    if (split.length > 1) {
        return {
            number: split.slice(0, -1).join(" "),
            bus: split[split.length - 1],
        };
    }

    return { number: str, bus: "" };
}

function isSameAddress(address: Address, sgv: SGVMember["adressen"][number]) {
    const { number, bus } = splitStreetNumber(address.number);
    return (
        StringCompare.typoCount(
            trimAddressPart(address.street),
            trimAddressPart(sgv.straat ?? ""),
        ) === 0 &&
        StringCompare.typoCount(
            trimAddressPart(address.city),
            trimAddressPart(sgv.gemeente ?? ""),
        ) === 0 &&
        StringCompare.typoCount(
            trimAddressPart(address.postalCode),
            trimAddressPart(sgv.postcode ?? ""),
        ) === 0 &&
        StringCompare.typoCount(
            trimAddressPart(number),
            trimAddressPart(sgv.nummer ?? ""),
        ) === 0 &&
        StringCompare.typoCount(
            trimAddressPart(bus),
            trimAddressPart(sgv.bus ?? ""),
        ) === 0
    );
}

/** Reuses an existing SGV address when possible so contacts keep stable address references after sync. */
function createOrUpdateAddress(
    address: Address,
    existingAddresses: SGVMember["adressen"],
    existingContacts: SGVMember["contacten"],
    index: number,
): SGVMember["adressen"][number] {
    const matchingAddresses = existingAddresses.filter((a) =>
        isSameAddress(address, a),
    );
    let existingAddress = matchingAddresses[0] ?? null;
    if (matchingAddresses.length > 1) {
        existingAddress =
            matchingAddresses.find((a) =>
                existingContacts.some((c) => c.adres === a.id),
            ) ?? existingAddress;
    }

    const { number, bus } = splitStreetNumber(address.number);
    const updated = {
        id: existingAddress?.id ?? `tempadres${index}${Date.now()}`,
        straat: trimAddressPart(address.street),
        bus: trimAddressPart(bus),
        nummer: trimAddressPart(number),
        postcode: trimAddressPart(address.postalCode),
        gemeente: trimAddressPart(address.city),
        land: address.country,
        status: "normaal",
        postadres: false,
        omschrijving: "",
        telefoon: "",
    };

    return existingAddress
        ? {
              ...existingAddress,
              ...updated,
              telefoon: existingAddress.telefoon,
              postadres: existingAddress.postadres,
              omschrijving: existingAddress.omschrijving,
          }
        : updated;
}

function isManaged(member: SGVMember, functions: SGVFunction[]) {
    return member.functies.some(
        (f) =>
            !f.einde && functions.some((g) => g.id === f.functie && !!g.code),
    );
}

/** Creates a patch that ends only active SGV functions managed by Stamhoofd. */
function createDeleteMemberPatch(
    member: SGVMember,
    functions: SGVFunction[],
): SGVMemberPatch {
    const managed = new Set(functions.filter((f) => !!f.code).map((f) => f.id));
    return {
        functies: member.functies.map((f) =>
            managed.has(f.functie) && !f.einde
                ? {
                      ...f,
                      einde: new Date().toISOString(),
                      links: undefined,
                      omschrijving: undefined,
                  }
                : f,
        ),
    };
}

export function getMemberName(member: SGVMember) {
    return `${member.vgagegevens.voornaam} ${member.vgagegevens.achternaam}`;
}

export function getMemberBirthDay(member: SGVMember) {
    return member.vgagegevens.geboortedatum;
}

export function getMemberFunctions(member: SGVMember) {
    return member.functies
        .filter((f) => !f.einde)
        .map((f) => f.omschrijving || f.code || "Onbekend")
        .join(", ");
}
