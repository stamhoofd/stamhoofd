export enum UmbrellaOrganization {
    ChiroNationaal = 'ChiroNationaal',
    ScoutsEnGidsenVlaanderen = 'ScoutsEnGidsenVlaanderen',
    KSA = 'KSA',
    KLJ = 'KLJ',
    FOS = 'FOSOpenScouting',
    JeugdRodeKruis = 'JeugdRodeKruis',
    JNM = 'JNM',
    Other = 'Other',
}

export class UmbrellaOrganizationHelper {
    static getName(umbrellaOrganization: UmbrellaOrganization): string {
        switch (umbrellaOrganization) {
            case UmbrellaOrganization.ChiroNationaal: return $t(`Chirojeugd Vlaanderen`);
            case UmbrellaOrganization.ScoutsEnGidsenVlaanderen: return $t(`Scouts & Gidsen Vlaanderen`);
            case UmbrellaOrganization.KSA: return $t(`KSA`);
            case UmbrellaOrganization.KLJ: return $t(`KLJ`);
            case UmbrellaOrganization.FOS: return $t(`FOS Open Scouting`);
            case UmbrellaOrganization.JeugdRodeKruis: return $t(`Jeugd Rode Kruis`);
            case UmbrellaOrganization.JNM: return $t(`JNM`);
            case UmbrellaOrganization.Other: return $t(`Andere / geen`);
        }
    }

    static getList() {
        const list = Object.values(UmbrellaOrganization);
        const ob: { name: string; value: UmbrellaOrganization }[] = [];
        for (const item of list) {
            ob.push({
                name: this.getName(item),
                value: item,
            });
        }
        return ob;
    }
}
