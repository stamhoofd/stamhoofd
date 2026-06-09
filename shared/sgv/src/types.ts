/** OAuth token response returned by SGV's Keycloak realm. */
export type SGVTokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: "Bearer";
};

/** Address object as SGV returns it for groups, members, and contacts. */
export type SGVAddress = {
    id: string;
    land: string;
    postcode: string;
    gemeente: string;
    straat: string;
    nummer: string;
    bus?: string;
    telefoon: string;
    postadres: boolean;
    status?: string;
    positie?: {
        latitude: number;
        longitude: number;
    };
    omschrijving?: string;
};

export type SGVGroup = {
    id: string;
    groepsnummer: string;
    naam: string;
    adressen: SGVAddress[];
};

export type SGVGroupResponse = {
    groepen: SGVGroup[];
};

export type SGVFunction = {
    id: string;
    beschrijving: string;
    type?: string;
    groepen: string[];
    code?: string | null;
};

export type SGVFunctionResponse = {
    functies: SGVFunction[];
};

export type SGVProfileFunction = {
    groep: string;
    begin: string;
    einde?: string;
    code?: string;
};

export type SGVProfileResponse = {
    functies: SGVProfileFunction[];
};

export type SGVSearchMember = {
    id: string;
    voornaam: string;
    achternaam: string;
    geboortedatum: string;
};

export type SGVSearchResponse = {
    leden: SGVSearchMember[];
};

export type SGVMemberSummary = {
    id: string;
    waarden: {
        "be.vvksm.groepsadmin.model.column.LidNummerColumn": string;
        "be.vvksm.groepsadmin.model.column.VoornaamColumn": string;
        "be.vvksm.groepsadmin.model.column.AchternaamColumn": string;
        "be.vvksm.groepsadmin.model.column.GeboorteDatumColumn": string;
    };
};

export type SGVMembersResponse = {
    aantal: number;
    offset: number;
    totaal: number;
    leden: SGVMemberSummary[];
};

export type SGVContact = {
    id: string;
    adres?: string;
    voornaam: string;
    achternaam: string;
    zelfdeAdres?: boolean;
    gsm?: string;
    email?: string;
    rol?: string;
};

export type SGVMemberFunction = {
    groep: string;
    functie: string;
    begin?: string | null;
    einde?: string | null;
    code?: string;
    omschrijving?: string;
    links?: unknown[];
};

export type SGVMember = {
    links?: Array<{ method: string; sections?: string[] }>;
    id: string;
    aangepast: string;
    persoonsgegevens: {
        geslacht?: string;
        gsm?: string;
        [key: string]: unknown;
    };
    vgagegevens: {
        voornaam: string;
        achternaam: string;
        geboortedatum: string;
        beperking?: boolean;
        verminderdlidgeld?: boolean;
        verhoogdekinderbijslag?: boolean;
        individueleSteekkaartdatumaangepast?: string;
        [key: string]: unknown;
    };
    verbondsgegevens: {
        lidnummer: string;
        klantnummer?: string;
        lidgeldbetaald?: boolean;
        lidkaartafgedrukt?: boolean;
        [key: string]: unknown;
    };
    email?: string;
    adressen: SGVAddress[];
    contacten: SGVContact[];
    groepseigenVelden?: Record<string, unknown>;
    functies: SGVMemberFunction[];
};

/** Patch payload for SGV members; immutable identifiers stay excluded while verbondsgegevens can be patched partially. */
export type SGVMemberPatch = Partial<
    Omit<SGVMember, "id" | "aangepast" | "verbondsgegevens">
> & {
    verbondsgegevens?: Partial<SGVMember["verbondsgegevens"]>;
};

export type SGVMemberListFilter = {
    criteria?: {
        functies?: string[];
        groepen?: string[];
        oudleden?: boolean;
    };
    kolommen?: string[];
    groepen?: string[];
    sortering?: string[];
    type?: string;
};
