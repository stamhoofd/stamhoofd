export enum UmbrellaOrganization {
    ChiroNationaal = "ChiroNationaal",
    ScoutsEnGidsenVlaanderen = "ScoutsEnGidsenVlaanderen",
    KSA = "KSA",
    KLJ = "KLJ",
    FOS = "FOSOpenScouting",
    JeugdRodeKruis = "JeugdRodeKruis",
    JNM = "JNM",
    Other = "Other",
}


export class UmbrellaOrganizationHelper {
    static getName(umbrellaOrganization: UmbrellaOrganization): string {
        switch(umbrellaOrganization) {
        case UmbrellaOrganization.ChiroNationaal: return "Chirojeugd Vlaanderen"
        case UmbrellaOrganization.ScoutsEnGidsenVlaanderen: return "Scouts & Gidsen Vlaanderen"
        case UmbrellaOrganization.KSA: return "KSA"
        case UmbrellaOrganization.KLJ: return "KLJ"
        case UmbrellaOrganization.FOS: return "FOS Open Scouting"
        case UmbrellaOrganization.JeugdRodeKruis: return "Jeugd Rode Kruis"
        case UmbrellaOrganization.JNM: return "JNM"
        case UmbrellaOrganization.Other: return "Andere"
        }
    }

    static getList() {
        const list = Object.values(UmbrellaOrganization)
        const ob: { name: string; value: UmbrellaOrganization }[] = []
        for (const item of list) {
            ob.push({
                name: this.getName(item),
                value: item
            })
        }
        return ob
    }
}