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
            case UmbrellaOrganization.ChiroNationaal: return $t(`13109d4e-6427-4d9b-a0a2-c01de76282c1`);
            case UmbrellaOrganization.ScoutsEnGidsenVlaanderen: return $t(`bea5dd9d-12e8-4f85-8bea-133467c3a737`);
            case UmbrellaOrganization.KSA: return $t(`b33fd0c6-4a54-469e-b108-d75f4d8c613d`);
            case UmbrellaOrganization.KLJ: return $t(`552906c2-db14-4bd8-b499-c29f61f57472`);
            case UmbrellaOrganization.FOS: return $t(`8f4d1891-4198-4133-8bcb-d90437affe83`);
            case UmbrellaOrganization.JeugdRodeKruis: return $t(`0979101f-70e9-4b59-a75e-43c9ee3b237f`);
            case UmbrellaOrganization.JNM: return $t(`5330841f-d2b1-4014-bbea-1b3a8a68faa3`);
            case UmbrellaOrganization.Other: return $t(`2ec07f88-b979-41a0-a948-63675a8dbcd6`);
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
