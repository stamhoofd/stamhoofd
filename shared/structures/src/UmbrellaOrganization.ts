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
            case UmbrellaOrganization.ChiroNationaal: return $t(`%nk`);
            case UmbrellaOrganization.ScoutsEnGidsenVlaanderen: return $t(`%nl`);
            case UmbrellaOrganization.KSA: return $t(`%1s`);
            case UmbrellaOrganization.KLJ: return $t(`%z`);
            case UmbrellaOrganization.FOS: return $t(`%1R`);
            case UmbrellaOrganization.JeugdRodeKruis: return $t(`%nm`);
            case UmbrellaOrganization.JNM: return $t(`%y`);
            case UmbrellaOrganization.Other: return $t(`%nn`);
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
