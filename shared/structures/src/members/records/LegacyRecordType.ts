import { LegacyRecord } from "./LegacyRecord";
import { RecordAnswer } from "./RecordAnswer";
import { RecordCategory } from "./RecordCategory";
import { RecordChoice, RecordSettings, RecordType, RecordWarning, RecordWarningType } from "./RecordSettings";

export enum LegacyRecordType {
    // Privacy
    DataPermissions = "DataPermissions",
    PicturePermissions = "PicturePermissions",
    GroupPicturePermissions = "GroupPicturePermissions",

    // Allergies & diet
    FoodAllergies = "FoodAllergies",
    MedicineAllergies = "MedicineAllergies",
    HayFever = "HayFever",
    OtherAllergies = "OtherAllergies",

    // Diet
    Vegetarian = "Vegetarian",
    Vegan = "Vegan",
    Halal = "Halal",
    Kosher = "Kosher",
    Diet = "Diet",

    // Medicines
    MedicinePermissions = "MedicinePermissions",
    TetanusVaccine = "TetanusVaccine",

    // Health, hygiene and sleep   
    CovidHighRisk = "CovidHighRisk",
    Asthma = "Asthma",
    BedWaters = "BedWaters",
    Epilepsy = "Epilepsy",
    HeartDisease = "HeartDisease",
    SkinCondition = "SkinCondition",
    Rheumatism = "Rheumatism",
    SleepWalking = "SleepWalking",
    Diabetes = "Diabetes",
    SpecialHealthCare = "SpecialHealthCare",
    
    // Medicines
    Medicines = "Medicines",

    // Sport, games, social
    CanNotSwim = "CanNotSwim",
    TiredQuickly = "TiredQuickly",
    CanNotParticipateInSport = "CanNotParticipateInSport",
    SpecialSocialCare = "SpecialSocialCare",

    // Other
    Other = "Other",

    // Moved
    FinancialProblems = "FinancialProblems",
}

/**
 * We removed all the inverse records, because they are getting too complicated, to fast.
 * We've moved them away to seperate ones
 */
export enum OldRecordType {
    // Privacy
    NoData = "NoData",
    NoPictures = "NoPictures",
    OnlyGroupPictures = "OnlyGroupPictures",

    // Diet
    Vegetarian = "Vegetarian",
    Vegan = "Vegan",
    Halal = "Halal",
    Kosher = "Kosher",
    Diet = "Diet",

    // Allergies & diet
    FoodAllergies = "FoodAllergies",
    MedicineAllergies = "MedicineAllergies",
    OtherAllergies = "OtherAllergies",

    // Medicines
    NoPermissionForMedicines = "NoPermissionForMedicines",

    // Health, hygiene and sleep
    HayFever = "HayFever",
    Asthma = "Asthma",
    BedWaters = "BedWaters",
    Epilepsy = "Epilepsy",
    HeartDisease = "HeartDisease",
    SkinCondition = "SkinCondition",
    Rheumatism = "Rheumatism",
    SleepWalking = "SleepWalking",
    Diabetes = "Diabetes",
    SpecialHealthCare = "SpecialHealthCare",
    Medicines = "Medicines",

    // Sport, games, social
    CanNotSwim = "CanNotSwim",
    TiredQuickly = "TiredQuickly",
    CanNotParticipateInSport = "CanNotParticipateInSport",
    SpecialSocialCare = "SpecialSocialCare",
    FinancialProblems = "FinancialProblems",

    // Other
    Other = "Other"
}

export enum LegacyRecordTypePriority {
    High = "High",
    Medium = "Medium",
    Low = "Low"
}

export class LegacyRecordTypeHelper {
    /**
     * Some types are only saved if permission is granted. But they should only be displayed
     * when they are not present. So the names and descriptions are only relevant when they are missing.
     * 
     * So before they are displayed, we switch them up: if they are not present, they are added
     * if they are present, they are removed
     */
    static isInverted(type: LegacyRecordType): boolean {
        switch (type) {
            case LegacyRecordType.DataPermissions:
            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.MedicinePermissions:
            case LegacyRecordType.TetanusVaccine:
            // Group picturs is not inverted -> we show a warning if there is only permissions for group pictures
                return true;
         
        }

        return false
    }

    /**
     * Store this information publicly (not end-to-end encrypted)
     */
    static isPublic(type: LegacyRecordType): boolean {
        switch (type) {
            case LegacyRecordType.DataPermissions:
            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
            case LegacyRecordType.MedicinePermissions:
                return true;
         
        }

        return false
    }

    static getFilterCategory(type: LegacyRecordType): string | undefined {
        switch (type) {
            case LegacyRecordType.DataPermissions:
            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
                return "Privacy";

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
            case LegacyRecordType.FoodAllergies:
                return "Voeding & dieet";

            case LegacyRecordType.CovidHighRisk:
            case LegacyRecordType.TetanusVaccine:
            case LegacyRecordType.Asthma:
            case LegacyRecordType.Epilepsy:
            case LegacyRecordType.HeartDisease:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.SkinCondition:
            case LegacyRecordType.Rheumatism:
            case LegacyRecordType.SleepWalking:
            case LegacyRecordType.Diabetes:
            case LegacyRecordType.MedicinePermissions:
                return "Gezondheid";

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
                return "Sport & Spel";
        }

        // others: keep name, don't repeat name
    }

    static getRecordCategory(type: LegacyRecordType): RecordCategory | undefined {
        switch (type) {
            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Privacy",
                    name: "Privacy"
                })

            case LegacyRecordType.FoodAllergies:
            case LegacyRecordType.MedicineAllergies:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.OtherAllergies:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Allergies",
                    name: "Allergieën"
                })

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Diet",
                    name: "Dieet"
                })

            case LegacyRecordType.CovidHighRisk:
            case LegacyRecordType.Asthma:
            case LegacyRecordType.BedWaters:
            case LegacyRecordType.Medicines:
            case LegacyRecordType.SpecialHealthCare:
            case LegacyRecordType.Epilepsy:
            case LegacyRecordType.HeartDisease:
            case LegacyRecordType.SkinCondition:
            case LegacyRecordType.Rheumatism:
            case LegacyRecordType.SleepWalking:
            case LegacyRecordType.Diabetes:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Health",
                    name: "Gezondheid, hygiëne & slapen"
                })

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Sport",
                    name: "Sport, spel en sociale omgang"
                })

            case LegacyRecordType.Other:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.Other",
                    name: "Andere inlichtingen"
                })

            case LegacyRecordType.TetanusVaccine:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.TetanusVaccine",
                    name: "Tetanusvaccinatie (klem)"
                })

            case LegacyRecordType.MedicinePermissions:
                return RecordCategory.create({
                    // We need to have a predictable id
                    id: "RecordCategory.MedicinePermissions",
                    name: "Toedienen van medicatie",
                    description: "Het is verboden om als begeleid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via deze steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp."
                })
        }

        // others: keep name, don't repeat name
    }

    static getCategory(type: LegacyRecordType): string | undefined {
        switch (type) {
            case LegacyRecordType.DataPermissions:
            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
                return "Privacy";

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
            case LegacyRecordType.Diet:
                return "Dieet";

            case LegacyRecordType.CovidHighRisk:
            case LegacyRecordType.Asthma:
            case LegacyRecordType.Epilepsy:
            case LegacyRecordType.HeartDisease:
            case LegacyRecordType.HayFever:
            case LegacyRecordType.SkinCondition:
            case LegacyRecordType.Rheumatism:
            case LegacyRecordType.SleepWalking:
            case LegacyRecordType.Diabetes:
                return "Gezondheid";

            case LegacyRecordType.CanNotSwim:
            case LegacyRecordType.TiredQuickly:
            case LegacyRecordType.CanNotParticipateInSport:
                return "Sport & Spel";

            case LegacyRecordType.Other:
                return "Andere inlichtingen";

            case LegacyRecordType.MedicinePermissions:
                return "Toedienen van medicatie";
        }

        // others: keep name, don't repeat name
    }

    static getWarningText(type: LegacyRecordType): string {
        switch (type) {
            case LegacyRecordType.DataPermissions:
                return "Geen toestemming voor verzamelen gevoelige gegevens";
            case LegacyRecordType.PicturePermissions:
                return "Geen foto's publiceren";
            case LegacyRecordType.GroupPicturePermissions:
                return "Enkel groepsfoto's mogen worden gepubliceerd";

            case LegacyRecordType.FoodAllergies:
                return "Allergisch of overgevoelig voor bepaalde voeding";
            case LegacyRecordType.MedicineAllergies:
                return "Allergisch voor geneesmiddelen";
            case LegacyRecordType.OtherAllergies:
                return "Allergisch voor bepaalde zaken";

            case LegacyRecordType.Vegetarian:
                return "Vegetarisch dieet";
            case LegacyRecordType.Vegan:
                return "Veganistisch dieet";
            case LegacyRecordType.Halal:
                return "Halal dieet";
            case LegacyRecordType.Kosher:
                return "Koosjer dieet";
            case LegacyRecordType.Diet:
                return "Speciaal dieet";

            case LegacyRecordType.TetanusVaccine:
                return "Geen tetanusvaccinatie";

            case LegacyRecordType.CovidHighRisk:
                return "Hoog-risicogroep voor coronavirus";
            case LegacyRecordType.Asthma:
                return "Astma";
            case LegacyRecordType.BedWaters:
                return "Bedwateren";
            case LegacyRecordType.Epilepsy:
                return "Epilepsie";
            case LegacyRecordType.HeartDisease:
                return "Hartaandoening";
            case LegacyRecordType.HayFever:
                return "Hooikoorts";
            case LegacyRecordType.SkinCondition:
                return "Huidaandoening";
            case LegacyRecordType.Rheumatism:
                return "Reuma";
            case LegacyRecordType.SleepWalking:
                return "Slaapwandelen";
            case LegacyRecordType.Diabetes:
                return "Diabetes";
            case LegacyRecordType.Medicines:
                return "Moet geneesmiddelen nemen";
            case LegacyRecordType.SpecialHealthCare:
                return "Speciale zorg om risico's te voorkomen";
            case LegacyRecordType.CanNotSwim:
                return "Kan niet (of onvoldoende) zwemmen";
            case LegacyRecordType.TiredQuickly:
                return "Is snel moe";
            case LegacyRecordType.CanNotParticipateInSport:
                return "Kan niet deelnemen aan sport en spel afgestemd op leeftijd";
            case LegacyRecordType.SpecialSocialCare:
                return "Bijzondere aandacht nodig bij sociale omgang";
            case LegacyRecordType.MedicinePermissions:
                return "Geen toestemming voor het toedienen van medicatie";
            case LegacyRecordType.FinancialProblems:
                return "Kansarm gezin";
            case LegacyRecordType.Other:
                return "Andere opmerking";
        }
    }

    static getName(type: LegacyRecordType): string {
        switch (type) {
            case LegacyRecordType.DataPermissions:
                return "Toestemming voor verzamelen gevoelige gegevens";
            case LegacyRecordType.PicturePermissions:
                return "Toestemming foto's";
            case LegacyRecordType.GroupPicturePermissions:
                return "Toestemming groepsfoto's";

            case LegacyRecordType.FoodAllergies:
                return "Allergisch of overgevoelig voor bepaalde voeding";
            case LegacyRecordType.MedicineAllergies:
                return "Allergisch voor geneesmiddelen";
            case LegacyRecordType.OtherAllergies:
                return "Allergisch voor bepaalde zaken";

            case LegacyRecordType.Vegetarian:
                return "Vegetarisch dieet";
            case LegacyRecordType.Vegan:
                return "Veganistisch dieet";
            case LegacyRecordType.Halal:
                return "Halal dieet";
            case LegacyRecordType.Kosher:
                return "Koosjer dieet";
            case LegacyRecordType.Diet:
                return "Speciaal dieet";

            case LegacyRecordType.TetanusVaccine:
                return "Tetanusvaccinatie";

            case LegacyRecordType.CovidHighRisk:
                return "Hoog-risicogroep voor coronavirus";
            case LegacyRecordType.Asthma:
                return "Astma";
            case LegacyRecordType.BedWaters:
                return "Bedwateren";
            case LegacyRecordType.Epilepsy:
                return "Epilepsie";
            case LegacyRecordType.HeartDisease:
                return "Hartaandoening";
            case LegacyRecordType.HayFever:
                return "Hooikoorts";
            case LegacyRecordType.SkinCondition:
                return "Huidaandoening";
            case LegacyRecordType.Rheumatism:
                return "Reuma";
            case LegacyRecordType.SleepWalking:
                return "Slaapwandelen";
            case LegacyRecordType.Diabetes:
                return "Diabetes";
            case LegacyRecordType.Medicines:
                return "Moet geneesmiddelen nemen";
            case LegacyRecordType.SpecialHealthCare:
                return "Speciale zorg om risico's te voorkomen";
            case LegacyRecordType.CanNotSwim:
                return "Kan niet (of onvoldoende) zwemmen";
            case LegacyRecordType.TiredQuickly:
                return "Is snel moe";
            case LegacyRecordType.CanNotParticipateInSport:
                return "Kan niet deelnemen aan sport en spel afgestemd op leeftijd";
            case LegacyRecordType.SpecialSocialCare:
                return "Bijzondere aandacht nodig bij sociale omgang";
            case LegacyRecordType.MedicinePermissions:
                return "Toestemming voor het toedienen van medicatie";
            case LegacyRecordType.FinancialProblems:
                return "Kansarm gezin";
            case LegacyRecordType.Other:
                return "Andere opmerking";
        }
    }


    static getHint(type: LegacyRecordType): string | null {
        switch (type) {
            case LegacyRecordType.Vegan:
                return "Geen dierlijke producten";

            case LegacyRecordType.Medicines:
                return "Dagelijks, wekelijks...";

            case LegacyRecordType.TetanusVaccine:
                return "In de afgelopen 10 jaar";

            case LegacyRecordType.OtherAllergies:
                return "Zoals verf, insecten...";

            case LegacyRecordType.Diet:
                return "Geen allergieën";
           
        }

        return null
    }

    static getInternalDescription(type: LegacyRecordType): string | null {
        switch (type) {
            case LegacyRecordType.DataPermissions:
                return "Dit gezin heeft ervoor gekozen om de steekkaart niet in te vullen omdat er geen toestemming werd gegeven i.v.m. het verzamelen van gevoelige gegevens. Bespreek dit zeker met de ouders.";
            case LegacyRecordType.PicturePermissions:
                return "Bij het inschrijven is er geen toestemming gegeven voor het publiceren van foto's op de website of sociale media.";
            case LegacyRecordType.GroupPicturePermissions:
                return "Bij het inschrijven is er wel toestemming gegeven voor het publiceren van groepsfoto's op de website of sociale media.";
            case LegacyRecordType.Vegetarian:
                return "Dit lid eet geen vlees en waarschijnlijk ook geen vis (dat vraag je best eens na). Hou hier rekening mee of bespreek dit met het lid.";
            case LegacyRecordType.Vegan:
                return "Een veganist eet geen dierlijke producten. Kijk zeker eens bij de links naar mogelijke alternatieven voor bepaalde producten. Bespreek dit ook zeker met het lid.";
            case LegacyRecordType.Halal:
                return "Kijk in onderstaande artikelen wat een Halal dieet precies inhoudt.";
            case LegacyRecordType.Kosher:
                return "Kijk in onderstaande artikelen wat een Koosjer dieet precies inhoudt.";
            case LegacyRecordType.MedicinePermissions:
                return "Het is verboden om als leid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via de steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp. In dit geval hebben de ouders geen toestemming gegeven.";
            case LegacyRecordType.FinancialProblems:
                return "Tijdens het inschrijven kunnen leden en hun ouders aangeven dat de kost zwaar op hun gezin kan liggen. Spring hier uiterst discreet mee om, maar communiceer dit ook naar de juiste personen om dit discreet te kunnen houden: je wilt absoluut niet dat medeleiding de vraag “heb jij je kampgeld al betaald?” stelt zonder dat ze van iets weten. Neem zeker een kijkje op onderstaande links.";
        }
        return null;
    }

    static getInternalLinks(type: LegacyRecordType): {name: string; url: string}[] {
        switch (type) {
            case LegacyRecordType.DataPermissions:
                return [
                    {
                        "name": "Welke persoonsgegevens worden als gevoelig beschouwd?",
                        "url": "https://ec.europa.eu/info/law/law-topic/data-protection/reform/rules-business-and-organisations/legal-grounds-processing-data/sensitive-data/what-personal-data-considered-sensitive_nl"
                    }
                ]
            case LegacyRecordType.PicturePermissions:
                return [
                    {
                        "name": "Recht op afbeelding",
                        "url": "https://www.gegevensbeschermingsautoriteit.be/recht-op-afbeelding"
                    }
                ]
            case LegacyRecordType.GroupPicturePermissions:
                return [
                    {
                        "name": "Recht op afbeelding",
                        "url": "https://www.gegevensbeschermingsautoriteit.be/recht-op-afbeelding"
                    }
                ]
            case LegacyRecordType.Vegetarian:
                return [
                    {
                        "name": "Vegetarische recepten van Eva VZW",
                        "url": "https://www.evavzw.be/recepten"
                    }
                ]
            case LegacyRecordType.Vegan:
                return [
                    { // todo
                        "name": "WAT IS HET VERSCHIL TUSSEN EEN VEGETARIËR EN EEN VEGANIST?",
                        "url": "https://www.watwat.be/eten/wat-het-verschil-tussen-een-vegetarier-en-een-veganist"
                    }
                ]
            case LegacyRecordType.Halal:
                return []; // todo
            case LegacyRecordType.Kosher:
                return []; // todo
           case LegacyRecordType.FinancialProblems:
                return []; // todo
        }
        return [];
    }

    static getPriority(type: LegacyRecordType): LegacyRecordTypePriority {
        switch (type) {
            case LegacyRecordType.DataPermissions:
                return LegacyRecordTypePriority.High;
            case LegacyRecordType.PicturePermissions:
                return LegacyRecordTypePriority.High;
            case LegacyRecordType.GroupPicturePermissions:
                return LegacyRecordTypePriority.High;
            case LegacyRecordType.FoodAllergies:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.MedicineAllergies:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.OtherAllergies:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.Vegetarian:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.Vegan:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.Halal:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.Kosher:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.Diet:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.CovidHighRisk:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.TetanusVaccine:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.Asthma:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.BedWaters:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.Epilepsy:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.HeartDisease:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.HayFever:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.SkinCondition:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.Rheumatism:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.SleepWalking:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.Diabetes:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.Medicines:
                return LegacyRecordTypePriority.High;
            case LegacyRecordType.SpecialHealthCare:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.CanNotSwim:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.TiredQuickly:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.CanNotParticipateInSport:
                return LegacyRecordTypePriority.Low;
            case LegacyRecordType.SpecialSocialCare:
                return LegacyRecordTypePriority.Medium;
            case LegacyRecordType.MedicinePermissions:
                return LegacyRecordTypePriority.High;
            case LegacyRecordType.FinancialProblems:
                return LegacyRecordTypePriority.High;
            case LegacyRecordType.Other:
                return LegacyRecordTypePriority.Medium;
        }
    }

    static convertToAnswer(record: LegacyRecord): RecordAnswer {
        // todo
        const answer = new RecordAnswer()
        answer.settings = this.convertToRecord(record.type)!

        return answer
    }

    static convert(types: LegacyRecordType[]): RecordCategory[] {
        // Make sure all the types are sorted in the default ordering
        const allTypes = Object.values(LegacyRecordType)

        types.sort((a, b) => {
            const index1 = allTypes.findIndex(q => q == a)
            const index2 = allTypes.findIndex(q => q == b)
            return index1 - index2
        })

        const categories: RecordCategory[] = []

        for (const type of types) {
            const category = this.getRecordCategory(type)
            const settings = this.convertToRecord(type)

            if (!category || !settings) {
                // Has custom migration
                continue
            }

            if (type == LegacyRecordType.PicturePermissions && types.includes(LegacyRecordType.GroupPicturePermissions) ) {
                // Skip: we ask group picture permissions alreadys
                continue
            }

            let exists = categories.find(c => c.id === category.id)

            if (!exists) {
                categories.push(category)
                exists = category
            }
            exists.records.push(settings)

        }

        return categories
    }

    static convertToRecord(type: LegacyRecordType): RecordSettings | null {
        if (type === LegacyRecordType.FinancialProblems || type === LegacyRecordType.DataPermissions) {
            // Should get moved to separate field in member details
            return null
        }

        const record = new RecordSettings()
        record.id = "legacy-type-"+type
        record.encrypted = !this.isPublic(type)
        record.sensitive = !this.isPublic(type)

        record.type = RecordType.Checkbox
        record.name = this.getName(type)


        switch (type) {
            case LegacyRecordType.PicturePermissions:
            case LegacyRecordType.GroupPicturePermissions:
                record.type = RecordType.ChooseOne
                record.required = true
                record.name = "Toestemming foto's"
                record.label = "Toestemming publicatie foto's"
                record.choices = [
                    RecordChoice.create({
                        id: "no",
                        name: "Nee, ik geef geen toestemming",
                        warning: RecordWarning.create({
                            id: "",
                            text: "Geen toestemming voor publicatie foto's",
                            type: RecordWarningType.Error
                        })
                    }),
                    RecordChoice.create({
                        id: "yes",
                        name: "Ja, ik geef toestemming"
                    }),
                    RecordChoice.create({
                        id: "groups_only",
                        name: "Ik geef enkel toestemming voor groepsfoto's",
                        warning: RecordWarning.create({
                            id: "",
                            text: "Enkel toestemming voor groepsfoto's",
                            type: RecordWarningType.Error
                        })
                    })
                ]
                record.description = "Tijdens de activiteiten maken we soms foto's die we publiceren op de website en sociale media."
                break

            case LegacyRecordType.FoodAllergies:
                record.askComments = true
                record.inputPlaceholder = "Som hier op welke zaken (bv. noten, lactose, ...). Vul eventueel aan met enkele voorbeelden";
                break
            case LegacyRecordType.MedicineAllergies:
                record.askComments = true
                record.inputPlaceholder = "Som hier op welke zaken (bv. bepaalde antibiotica, ontsmettingsmiddelen, pijnstillers, ...). Vul eventueel aan met enkele voorbeelden";
                break
            case LegacyRecordType.HayFever:
                break
            case LegacyRecordType.OtherAllergies:
                record.askComments = true
                record.inputPlaceholder = "Som hier op welke zaken";
                break

            case LegacyRecordType.Vegetarian:
            case LegacyRecordType.Vegan:
            case LegacyRecordType.Halal:
            case LegacyRecordType.Kosher:
                break

            case LegacyRecordType.Diet:
                record.askComments = true
                record.inputPlaceholder = "Beschrijving van ander soort dieet. Allergieën hoef je hier niet nog eens te vermelden.";
                break

            case LegacyRecordType.CovidHighRisk:
            case LegacyRecordType.Asthma:
            case LegacyRecordType.BedWaters:
            case LegacyRecordType.Epilepsy:
            case LegacyRecordType.HeartDisease:
            case LegacyRecordType.SkinCondition:
            case LegacyRecordType.Rheumatism:
            case LegacyRecordType.SleepWalking:
            case LegacyRecordType.Diabetes:
                record.askComments = true
                record.inputPlaceholder = "Optioneel";
                break

            case LegacyRecordType.Medicines:
                record.askComments = true
                record.inputPlaceholder = "Welke, wanneer en hoe vaak?";
                record.commentsDescription = "Gelieve ons ook de noodzakelijke doktersattesten te bezorgen."
                break

            case LegacyRecordType.SpecialHealthCare:
                record.askComments = true
                record.inputPlaceholder = "Welke?";
                break

            case LegacyRecordType.TetanusVaccine:
                record.askComments = true
                record.inputPlaceholder = "In welk jaar? (mag maximaal 10 jaar geleden zijn)";
                record.commentsDescription = "Een vaccinatie voor tetanus/klem is 10 jaar werkzaam, daarna is een nieuwe vaccinatie noodzakelijk."
                break
                
            case LegacyRecordType.CanNotParticipateInSport:
            case LegacyRecordType.SpecialSocialCare:
                record.askComments = true
                record.inputPlaceholder = "Meer informatie";
                break

            case LegacyRecordType.Other:
                record.type = RecordType.Textarea
                record.inputPlaceholder = "Enkel invullen indien van toepassing";
                break

            case LegacyRecordType.MedicinePermissions:
                record.label = "Wij geven toestemming aan de begeleiders om bij hoogdringendheid aan onze zoon of dochter een dosis via de apotheek vrij verkrijgbare pijnstillende en koortswerende medicatie toe te dienen*"
                record.description = "* gebaseerd op aanbeveling Kind & Gezin 09.12.2009 – Aanpak van koorts / Toedienen van geneesmiddelen in de kinderopvang";
                break
        }

        if (record.type === RecordType.Checkbox || record.type === RecordType.Textarea) {
            record.warning = RecordWarning.create({
                text: this.getWarningText(type),
                type: this.getPriority(type) == LegacyRecordTypePriority.Low ? RecordWarningType.Info : (this.getPriority(type) == LegacyRecordTypePriority.Medium ? RecordWarningType.Warning : RecordWarningType.Error),
                inverted: this.isInverted(type)
            })
        }

        return record
    }
}
