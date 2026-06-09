import {
    defaultSGVFunctions,
    defaultSGVGroup,
    defaultSGVGroupNumber,
    defaultSGVProfile,
    createSGVMemberFixture,
} from "@stamhoofd/sgv";
import type {
    SGVFunction,
    SGVGroup,
    SGVMember,
    SGVMemberListFilter,
    SGVMemberPatch,
    SGVMemberSummary,
    SGVSearchMember,
    SGVTokenResponse,
} from "@stamhoofd/sgv";

/** Mutable in-memory SGV data store shared by mock endpoints and reset between tests. */
export class SGVMockState {
    private nextMemberId = 2;
    private nextMemberNumber = 124;
    groups: SGVGroup[] = [structuredClone(defaultSGVGroup)];
    functions: SGVFunction[] = structuredClone(defaultSGVFunctions);
    members: SGVMember[] = [createSGVMemberFixture()];
    currentFilter: SGVMemberListFilter | null = null;

    token(): SGVTokenResponse {
        return {
            access_token: "sgv-mock-access-token",
            refresh_token: "sgv-mock-refresh-token",
            expires_in: 3600,
            token_type: "Bearer",
        };
    }

    profile() {
        return structuredClone(defaultSGVProfile);
    }

    createFunction(body: Partial<SGVFunction>): SGVFunction {
        const functie: SGVFunction = {
            id: body.id ?? `functie-${this.functions.length + 1}`,
            beschrijving: body.beschrijving ?? "Nieuwe functie",
            type: body.type ?? "groepseigen",
            groepen: body.groepen ?? [defaultSGVGroupNumber],
            code: body.code ?? null,
        };
        this.functions.push(functie);
        return structuredClone(functie);
    }

    listMembers(offset: number, aantal: number): SGVMemberSummary[] {
        return this.members.slice(offset, offset + aantal).map(memberToSummary);
    }

    searchSimilar(firstName: string, lastName: string): SGVSearchMember[] {
        const needle = `${firstName} ${lastName}`.toLowerCase().trim();
        return this.members
            .filter((member) => {
                const name =
                    `${member.vgagegevens.voornaam} ${member.vgagegevens.achternaam}`.toLowerCase();
                return (
                    name.includes(needle) ||
                    needle.includes(name) ||
                    member.vgagegevens.voornaam.toLowerCase() ===
                        firstName.toLowerCase() ||
                    member.vgagegevens.achternaam.toLowerCase() ===
                        lastName.toLowerCase()
                );
            })
            .map(memberToSearchMember);
    }

    getMember(id: string): SGVMember | undefined {
        const member = this.members.find((member) => member.id === id);
        return member ? structuredClone(member) : undefined;
    }

    /** Creates a member with SGV-like generated ids and member numbers, then applies the incoming patch. */
    createMember(patch: SGVMemberPatch): SGVMember {
        const member = mergeMember(
            createSGVMemberFixture({
                id: `member-${this.nextMemberId++}`,
                verbondsgegevens: {
                    lidnummer: String(this.nextMemberNumber++),
                    klantnummer: "I00000",
                    lidgeldbetaald: false,
                    lidkaartafgedrukt: false,
                },
            }),
            patch,
        );
        this.members.push(member);
        return structuredClone(member);
    }

    /** Applies SGV patch semantics to an existing member while preserving omitted nested fields. */
    patchMember(id: string, patch: SGVMemberPatch): SGVMember | undefined {
        const index = this.members.findIndex((member) => member.id === id);
        if (index === -1) {
            return undefined;
        }
        this.members[index] = mergeMember(this.members[index], patch);
        return structuredClone(this.members[index]);
    }

    reset(): void {
        this.nextMemberId = 2;
        this.nextMemberNumber = 124;
        this.groups = [structuredClone(defaultSGVGroup)];
        this.functions = structuredClone(defaultSGVFunctions);
        this.members = [createSGVMemberFixture()];
        this.currentFilter = null;
    }
}

export const sgvMockState = new SGVMockState();

/** Merges SGV member patches shallowly at the top level and within known nested objects, mirroring how the sync client patches. */
function mergeMember(member: SGVMember, patch: SGVMemberPatch): SGVMember {
    return {
        ...member,
        ...patch,
        aangepast: new Date().toISOString(),
        persoonsgegevens: {
            ...member.persoonsgegevens,
            ...patch.persoonsgegevens,
        },
        vgagegevens: {
            ...member.vgagegevens,
            ...patch.vgagegevens,
        },
        verbondsgegevens: {
            ...member.verbondsgegevens,
            ...patch.verbondsgegevens,
        },
        adressen: patch.adressen ?? member.adressen,
        contacten: patch.contacten ?? member.contacten,
        functies: patch.functies ?? member.functies,
    };
}

function memberToSearchMember(member: SGVMember): SGVSearchMember {
    return {
        id: member.id,
        voornaam: member.vgagegevens.voornaam,
        achternaam: member.vgagegevens.achternaam,
        geboortedatum: member.vgagegevens.geboortedatum,
    };
}

function memberToSummary(member: SGVMember): SGVMemberSummary {
    const [year, month, day] = member.vgagegevens.geboortedatum.split("-");
    return {
        id: member.id,
        waarden: {
            "be.vvksm.groepsadmin.model.column.LidNummerColumn":
                member.verbondsgegevens.lidnummer,
            "be.vvksm.groepsadmin.model.column.VoornaamColumn":
                member.vgagegevens.voornaam,
            "be.vvksm.groepsadmin.model.column.AchternaamColumn":
                member.vgagegevens.achternaam,
            "be.vvksm.groepsadmin.model.column.GeboorteDatumColumn": `${day}/${month}/${year}`,
        },
    };
}
