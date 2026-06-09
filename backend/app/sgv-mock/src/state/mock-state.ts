import {
    createSGVLidFixture,
    defaultSGVFuncties,
    defaultSGVGroepen,
    defaultSGVGroepNumber,
    defaultSGVProfile,
} from '@stamhoofd/sgv';
import type {
    SGVFunctieCreateRequest,
    SGVFunctie,
    SGVGroep,
    SGVLedenLijstFilterRequest,
    SGVLedenLijstLid,
    SGVLidPatch,
    SGVTokenResponse,
    SGVZoekLid,
} from '@stamhoofd/sgv';
import {
    SGVAdres,
    SGVFunctie as SGVFunctieStruct,
    SGVGroep as SGVGroepStruct,
    SGVLedenLijstLid as SGVLedenLijstLidStruct,
    SGVLedenLijstWaarden,
    SGVLidGet,
    SGVMyFunctie,
    SGVProfielResponse,
    SGVZoekLid as SGVZoekLidStruct,
} from '@stamhoofd/sgv';
import { ObjectData } from '@simonbackx/simple-encoding';

export type SGVMockCall = {
    sequence: number;
    method: string;
    path: string;
    query: Record<string, string | string[]>;
    body: unknown;
};

export type SGVMockFailure = {
    method: string;
    path: string;
    status: number;
    body?: unknown;
    times?: number;
};

export type SGVMockStatePatch = {
    groups?: SGVGroep[];
    functions?: SGVFunctie[];
    members?: SGVLidGet[];
    profile?: SGVProfielResponse | { functies: SGVMyFunctie[] };
    token?: Partial<SGVTokenResponse>;
    nextMemberId?: number;
    nextMemberNumber?: number;
    currentFilter?: SGVLedenLijstFilterRequest | null;
};

type SGVMockAuthorizationCode = {
    clientId: string;
    redirectUri: string;
};

/** Mutable in-memory SGV data store shared by mock endpoints and reset between tests. */
export class SGVMockState {
    nextMemberId = 2;
    nextMemberNumber = 124;
    groups: SGVGroep[] = defaultSGVGroepen.map(group => group.clone());
    functions: SGVFunctie[] = defaultSGVFuncties.map(functie => functie.clone());
    members: SGVLidGet[] = [createSGVLidFixture()];
    currentFilter: SGVLedenLijstFilterRequest | null = null;
    profileResponse: SGVProfielResponse = defaultSGVProfile.clone();
    tokenResponse: SGVTokenResponse = defaultToken();
    calls: SGVMockCall[] = [];
    failures: SGVMockFailure[] = [];
    authorizationCodes = new Map<string, SGVMockAuthorizationCode>();
    private nextCallSequence = 1;
    private nextAuthorizationCode = 1;

    token(): SGVTokenResponse {
        return { ...this.tokenResponse };
    }

    createAuthorizationCode(details: SGVMockAuthorizationCode): string {
        const code = `sgv-mock-${this.nextAuthorizationCode++}`;
        this.authorizationCodes.set(code, details);
        return code;
    }

    consumeAuthorizationCode(code: string): SGVMockAuthorizationCode | null {
        const details = this.authorizationCodes.get(code);
        if (!details) {
            return null;
        }
        this.authorizationCodes.delete(code);
        return details;
    }

    profile() {
        return this.profileResponse.clone();
    }

    snapshot() {
        return {
            groups: this.groups,
            functions: this.functions,
            members: this.members,
            profile: this.profileResponse,
            token: this.tokenResponse,
            currentFilter: this.currentFilter,
            calls: this.calls,
            failures: this.failures,
            authorizationCodes: Array.from(this.authorizationCodes.keys()),
            nextMemberId: this.nextMemberId,
            nextMemberNumber: this.nextMemberNumber,
        };
    }

    setState(patch: SGVMockStatePatch): void {
        if (patch.groups) {
            this.groups = patch.groups.map(group => decodeGroup(group));
        }
        if (patch.functions) {
            this.functions = patch.functions.map(functie => decodeFunction(functie));
        }
        if (patch.members) {
            this.members = patch.members.map(member => cloneMember(decodeMember(member)));
        }
        if (patch.profile) {
            this.profileResponse = patch.profile instanceof SGVProfielResponse
                ? patch.profile.clone()
                : decodeProfile(patch.profile);
        }
        if (patch.token) {
            this.tokenResponse = {
                ...this.tokenResponse,
                ...patch.token,
            };
        }
        if (patch.nextMemberId !== undefined) {
            this.nextMemberId = patch.nextMemberId;
        }
        if (patch.nextMemberNumber !== undefined) {
            this.nextMemberNumber = patch.nextMemberNumber;
        }
        if ('currentFilter' in patch) {
            this.currentFilter = patch.currentFilter ?? null;
        }
    }

    addFailure(failure: SGVMockFailure): void {
        this.failures.push({ ...failure, method: failure.method.toUpperCase(), times: failure.times ?? 1 });
    }

    recordCall(call: Omit<SGVMockCall, 'sequence'>): void {
        this.calls.push({
            ...call,
            method: call.method.toUpperCase(),
            sequence: this.nextCallSequence++,
        });
    }

    consumeFailure(method: string, path: string): SGVMockFailure | null {
        const index = this.failures.findIndex(failure => failure.method.toUpperCase() === method.toUpperCase() && failure.path === path && (failure.times ?? 1) > 0);
        if (index === -1) {
            return null;
        }

        const failure = this.failures[index];
        failure.times = (failure.times ?? 1) - 1;
        if (failure.times <= 0) {
            this.failures.splice(index, 1);
        }
        return failure;
    }

    createFunction(body: SGVFunctieCreateRequest): SGVFunctie {
        const functie = SGVFunctieStruct.create({
            id: body.id ?? `functie-${this.functions.length + 1}`,
            beschrijving: body.beschrijving ?? 'Nieuwe functie',
            type: body.type ?? 'groepseigen',
            groepen: body.groepen ?? [defaultSGVGroepNumber],
            code: body.code,
        });
        this.functions.push(functie);
        return structuredClone(functie);
    }

    listMembers(offset: number, aantal: number): SGVLedenLijstLid[] {
        return this.members.slice(offset, offset + aantal).map(memberToSummary);
    }

    searchSimilar(firstName: string, lastName: string): SGVZoekLid[] {
        const needle = `${firstName} ${lastName}`.toLowerCase().trim();
        return this.members
            .filter((member) => {
                const name =
                    `${member.firstName} ${member.lastName}`.toLowerCase();
                return (
                    name.includes(needle) ||
                    needle.includes(name) ||
                    member.firstName.toLowerCase() ===
                        firstName.toLowerCase() ||
                    member.lastName.toLowerCase() ===
                        lastName.toLowerCase()
                );
            })
            .map(memberToSearchMember);
    }

    getMember(id: string): SGVLidGet | undefined {
        const member = this.members.find((member) => member.id === id);
        return member ? cloneMember(member) : undefined;
    }

    /** Creates a member with SGV-like generated ids and member numbers, then applies the incoming patch. */
    createMember(patch: SGVLidPatch): SGVLidGet {
        const member = mergeMember(
            createSGVLidFixture({
                id: `member-${this.nextMemberId++}`,
                verbondsgegevens: {
                    lidnummer: String(this.nextMemberNumber++),
                    klantnummer: 'I00000',
                    lidgeldbetaald: false,
                    lidkaartafgedrukt: false,
                },
            }),
            patch,
        );
        this.members.push(member);
        return cloneMember(member);
    }

    /** Applies SGV patch semantics to an existing member while preserving omitted nested fields. */
    patchMember(id: string, patch: SGVLidPatch): SGVLidGet | undefined {
        const index = this.members.findIndex((member) => member.id === id);
        if (index === -1) {
            return undefined;
        }
        this.members[index] = mergeMember(this.members[index], patch);
        return cloneMember(this.members[index]);
    }

    reset(): void {
        this.nextMemberId = 2;
        this.nextMemberNumber = 124;
        this.groups = defaultSGVGroepen.map(group => group.clone());
        this.functions = defaultSGVFuncties.map(functie => functie.clone());
        this.members = [createSGVLidFixture()];
        this.currentFilter = null;
        this.profileResponse = defaultSGVProfile.clone();
        this.tokenResponse = defaultToken();
        this.calls = [];
        this.failures = [];
        this.authorizationCodes.clear();
        this.nextCallSequence = 1;
        this.nextAuthorizationCode = 1;
    }
}

export const sgvMockState = new SGVMockState();

function defaultToken(): SGVTokenResponse {
    return {
        access_token: 'sgv-mock-access-token',
        refresh_token: 'sgv-mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
    };
}

function decodeGroup(value: SGVGroep | Record<string, unknown>): SGVGroep {
    if (value && typeof value === 'object' && 'clone' in value && typeof value.clone === 'function') {
        return value.clone() as SGVGroep;
    }
    return new ObjectData(value as Record<string, unknown>, { version: 0 }).decode(SGVGroepStruct) as SGVGroep;
}

function decodeFunction(value: SGVFunctie | Record<string, unknown>): SGVFunctie {
    if (value && typeof value === 'object' && 'clone' in value && typeof value.clone === 'function') {
        return value.clone() as SGVFunctie;
    }
    return new ObjectData(value as Record<string, unknown>, { version: 0 }).decode(SGVFunctieStruct) as SGVFunctie;
}

function decodeMember(value: SGVLidGet | Record<string, unknown>): SGVLidGet {
    if (value && typeof value === 'object' && 'clone' in value && typeof value.clone === 'function') {
        return value.clone() as SGVLidGet;
    }
    const member = value as any;
    return createSGVLidFixture({
        id: member.id,
        vgagegevens: member.vgagegevens,
        verbondsgegevens: member.verbondsgegevens,
        persoonsgegevens: member.persoonsgegevens,
        adressen: member.adressen?.map((adres: any) => decodeAddress(adres)),
        contacten: member.contacten,
        functies: member.functies?.map((functie: any) => decodeMyFunction(functie)),
        links: member.links,
        email: member.email,
    });
}

function decodeAddress(value: SGVAdres | Record<string, unknown>): SGVAdres {
    if (value && typeof value === 'object' && 'clone' in value && typeof value.clone === 'function') {
        return value.clone() as SGVAdres;
    }
    return SGVAdres.create(value as any);
}

function decodeMyFunction(value: SGVMyFunctie | Record<string, unknown>): SGVMyFunctie {
    if (value && typeof value === 'object' && 'clone' in value && typeof value.clone === 'function') {
        return value.clone() as SGVMyFunctie;
    }
    return SGVMyFunctie.create(value as any);
}

function decodeProfile(value: SGVProfielResponse | { functies: SGVMyFunctie[] } | Record<string, unknown>): SGVProfielResponse {
    if (value && typeof value === 'object' && 'clone' in value && typeof value.clone === 'function') {
        return value.clone() as SGVProfielResponse;
    }
    return new ObjectData(value as Record<string, unknown>, { version: 0 }).decode(SGVProfielResponse) as SGVProfielResponse;
}

/** Merges SGV member patches shallowly at the top level and within known nested objects, mirroring how the sync client patches. */
function mergeMember(member: SGVLidGet, patch: SGVLidPatch): SGVLidGet {
    const vgagegevens = {
        ...requiredVgaGegevens(member),
        ...patch.vgagegevens,
    };
    const verbondsgegevens = {
        ...member.verbondsgegevens,
        ...patch.verbondsgegevens,
    };
    const [year, month, day] = vgagegevens.geboortedatum.split('-').map(value => Number.parseInt(value, 10));

    const updatedMember = new SGVLidGet({
        id: member.id,
        firstName: vgagegevens.voornaam,
        lastName: vgagegevens.achternaam,
        lidNummer: verbondsgegevens.lidnummer,
        birthDay: new Date(year, month - 1, day, 12),
    });
    Object.assign(updatedMember, {
        ...member,
        ...patch,
        persoonsgegevens: {
            ...member.persoonsgegevens,
            ...patch.persoonsgegevens,
        },
        vgagegevens,
        verbondsgegevens,
        adressen: patch.adressen ?? member.adressen,
        contacten: patch.contacten ?? member.contacten,
        functies: patch.functies ?? member.functies,
    });
    return updatedMember;
}

function memberToSearchMember(member: SGVLidGet): SGVZoekLid {
    return SGVZoekLidStruct.create({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        birthDayString: member.vgagegevens?.geboortedatum ?? member.birthDay.toISOString().slice(0, 10),
    });
}

function requiredVgaGegevens(member: SGVLidGet) {
    if (!member.vgagegevens) {
        return {
            voornaam: member.firstName,
            achternaam: member.lastName,
            geboortedatum: member.birthDay.toISOString().slice(0, 10),
        };
    }
    return member.vgagegevens;
}

function cloneMember(member: SGVLidGet): SGVLidGet {
    return createSGVLidFixture({
        ...member,
        persoonsgegevens: member.persoonsgegevens ? { ...member.persoonsgegevens } : undefined,
        vgagegevens: member.vgagegevens ? { ...member.vgagegevens } : undefined,
        verbondsgegevens: { ...member.verbondsgegevens },
        adressen: member.adressen?.map(adres => adres.clone()) ?? [],
        contacten: member.contacten?.map(contact => ({ ...contact })) ?? [],
        functies: member.functies?.map(functie => functie.clone()) ?? [],
    });
}

function memberToSummary(member: SGVLidGet): SGVLedenLijstLid {
    return SGVLedenLijstLidStruct.create({
        id: member.id,
        waarden: SGVLedenLijstWaarden.create({
            lidNummer: member.lidNummer,
            firstName: member.firstName,
            lastName: member.lastName,
            birthDay: `${member.birthDay.getDate().toString().padStart(2, '0')}/${(member.birthDay.getMonth() + 1).toString().padStart(2, '0')}/${member.birthDay.getFullYear()}`,
        }),
    });
}
