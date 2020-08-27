export enum RecordType {
    // Privacy
    NoData = "NoData",
    NoPictures = "NoPictures",
    NoGroupPictures=" NoGroupPictures",

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

    // Health, hygiene and sleep
    Asthma = "Asthma",
    BedWaters = "BedWaters",
    Epilepsy = "Epilepsy",
    HeartDisease = "HeartDisease",
    SkinCondition = "SkinCondition",
    Rheumatism = "Rheumatism",
    SleepWalking = "SleepWalking",
    Diabetes = "Diabetes",
    Medicines = "Medicines",
    SpecialHealthCare = "SpecialHealthCare",

    // Sport, games, social
    CanNotSwim = "CanNotSwim",
    TiredQuickly = "TiredQuickly",
    CanNotParticipateInSport = "CanNotParticipateInSport",
    SpecialSocialCare = "SpecialSocialCare",

    // Medicines
    NoPermissionForMedicines = "NoPermissionForMedicines",

    FinancialProblems = "FinancialProblems",

    // Other
    Other = "Other"
}

export enum RecordTypePriority {
    High = "High",
    Medium = "Medium",
    Low = "Low"
}

export class RecordTypeHelper {
    static getName(type: RecordType): string {
        switch (type) {
            case RecordType.NoData:
                return "Geen toestemming voor verzamelen gevoelige gegevens";
            case RecordType.NoPictures:
                return "Geen foto's maken";
            case RecordType.NoGroupPictures:
                return "Niet op groepsfoto's";
            case RecordType.FoodAllergies:
                return "Allergisch voor voeding";
            case RecordType.MedicineAllergies:
                return "Allergisch voor geneesmiddelen";
            case RecordType.OtherAllergies:
                return "Allergisch voor bepaalde zaken";

            case RecordType.Vegetarian:
                return "Vegetarisch dieet";
            case RecordType.Vegan:
                return "Veganistisch dieet (geen dierlijke producten)";
            case RecordType.Halal:
                return "Halal dieet";
            case RecordType.Kosher:
                return "Koosjer dieet";
            case RecordType.Diet:
                return "Speciaal dieet";

            case RecordType.Asthma:
                return "Astma";
            case RecordType.BedWaters:
                return "Bedwateren";
            case RecordType.Epilepsy:
                return "Epilepsie";
            case RecordType.HeartDisease:
                return "Hartaandoening";
            case RecordType.HayFever:
                return "Hooikoorts";
            case RecordType.SkinCondition:
                return "Huidaandoening";
            case RecordType.Rheumatism:
                return "Reuma";
            case RecordType.SleepWalking:
                return "Slaapwandelen";
            case RecordType.Diabetes:
                return "Diabetes";
            case RecordType.Medicines:
                return "Moet medicijnen nemen";
            case RecordType.SpecialHealthCare:
                return "Speciale zorg om risico's te voorkomen";
            case RecordType.CanNotSwim:
                return "Kan niet zwemmen";
            case RecordType.TiredQuickly:
                return "Is snel moe";
            case RecordType.CanNotParticipateInSport:
                return "Kan niet deelenemen aan sport en spel afgestemd op leeftijd";
            case RecordType.SpecialSocialCare:
                return "Speciale aandacht nodig bij sociale omgang";
            case RecordType.NoPermissionForMedicines:
                return "Geen toestemming voor het toedienen van medicatie";
            case RecordType.FinancialProblems:
                return "Gezin met financiële moeilijkheden";
            case RecordType.Other:
                return "Andere opmerking";
        }
    }

    static getInternalDescription(type: RecordType): string | null {
        switch (type) {
            case RecordType.NoData:
                return "Dit gezin heeft ervoor gekozen om de steekkaart niet in te vullen omdat er geen toestemming werd gegeven i.v.m. het verzamelen van gevoelige gegevens. Bespreek dit zeker met de ouders.";
            case RecordType.NoPictures:
                return "Bij het inschrijven is er geen toestemming gegeven voor het puliceren van foto's op de website of sociale media.";
            case RecordType.NoGroupPictures:
                return "Bij het inschrijven is er geen toestemming gegeven voor het puliceren van groepsfoto's op de website of sociale media.";
            case RecordType.Vegetarian:
                return "Dit lid eet geen vlees en waarschijnlijk ook geen vis (dat vraag je best eens na). Hou hier rekening mee of bespreek dit met het lid.";
            case RecordType.Vegan:
                return "Een veganist eet geen dierlijke producten. Kijk zeker eens bij de links naar mogelijke alternatieven voor bepaalde producten. Bespreek dit ook zeker met het lid.";
            case RecordType.Halal:
                return "Kijk in onderstaande artikelen wat een Halal dieet precies inhoudt.";
            case RecordType.Kosher:
                return "Kijk in onderstaande artikelen wat een Koosjer dieet precies inhoudt.";
            case RecordType.NoPermissionForMedicines:
                return "Het is verboden om als leid(st)er, behalve EHBO, op eigen initiatief medische handelingen uit te voeren. Ook het verstrekken van lichte pijnstillende en koortswerende medicatie zoals Perdolan, Dafalgan of Aspirine is, zonder toelating van de ouders, voorbehouden aan een arts. Daarom is het noodzakelijk om via de steekkaart vooraf toestemming van ouders te hebben voor het eventueel toedienen van dergelijke hulp. In dit geval hebben de ouders geen toestemming gegeven.";
            case RecordType.FinancialProblems:
                return "Tijdens het inschrijven kunnen leden en hun ouders aangeven dat de kost zwaar op hun gezin kan liggen. Spring hier uiterst discreet mee om, maar communiceer dit ook naar de juiste personen om dit discreet te kunnen houden: je wilt absoluut niet dat medeleiding de vraag “heb jij je kampgeld al betaald?” stelt zonder dat ze van iets weten. Neem zeker een kijkje op onderstaande links.";
        }
        return null;
    }

    static getInternalLinks(type: RecordType): {name: string; url: string}[] {
        switch (type) {
            case RecordType.NoData:
                return [
                    {
                        "name": "Welke persoonsgegevens worden als gevoelig beschouwd?",
                        "url": "https://ec.europa.eu/info/law/law-topic/data-protection/reform/rules-business-and-organisations/legal-grounds-processing-data/sensitive-data/what-personal-data-considered-sensitive_nl"
                    }
                ]
            case RecordType.NoPictures:
                return [
                    {
                        "name": "Recht op afbeelding",
                        "url": "https://www.gegevensbeschermingsautoriteit.be/recht-op-afbeelding"
                    }
                ]
            case RecordType.Vegetarian:
                return [
                    {
                        "name": "Vegetarische recepten van Eva VZW",
                        "url": "https://www.evavzw.be/recepten"
                    }
                ]
            case RecordType.Vegan:
                return [
                    { // todo
                        "name": "WAT IS HET VERSCHIL TUSSEN EEN VEGETARIËR EN EEN VEGANIST?",
                        "url": "https://www.watwat.be/eten/wat-het-verschil-tussen-een-vegetarier-en-een-veganist"
                    }
                ]
            case RecordType.Halal:
                return []; // todo
            case RecordType.Kosher:
                return []; // todo
           case RecordType.FinancialProblems:
                return []; // todo
        }
        return [];
    }

    static getPriority(type: RecordType): string {
        switch (type) {
            case RecordType.NoData:
                return RecordTypePriority.High;
            case RecordType.NoPictures:
                return RecordTypePriority.High;
            case RecordType.NoGroupPictures:
                return RecordTypePriority.High;
            case RecordType.FoodAllergies:
                return RecordTypePriority.Medium;
            case RecordType.MedicineAllergies:
                return RecordTypePriority.Medium;
            case RecordType.OtherAllergies:
                return RecordTypePriority.Medium;
            case RecordType.Vegetarian:
                return RecordTypePriority.Low;
            case RecordType.Vegan:
                return RecordTypePriority.Low;
            case RecordType.Halal:
                return RecordTypePriority.Low;
            case RecordType.Kosher:
                return RecordTypePriority.Low;
            case RecordType.Diet:
                return RecordTypePriority.Low;
            case RecordType.Asthma:
                return RecordTypePriority.Medium;
            case RecordType.BedWaters:
                return RecordTypePriority.Medium;
            case RecordType.Epilepsy:
                return RecordTypePriority.Medium;
            case RecordType.HeartDisease:
                return RecordTypePriority.Medium;
            case RecordType.HayFever:
                return RecordTypePriority.Low;
            case RecordType.SkinCondition:
                return RecordTypePriority.Medium;
            case RecordType.Rheumatism:
                return RecordTypePriority.Low;
            case RecordType.SleepWalking:
                return RecordTypePriority.Low;
            case RecordType.Diabetes:
                return RecordTypePriority.Medium;
            case RecordType.Medicines:
                return RecordTypePriority.High;
            case RecordType.SpecialHealthCare:
                return RecordTypePriority.Medium;
            case RecordType.CanNotSwim:
                return RecordTypePriority.Medium;
            case RecordType.TiredQuickly:
                return RecordTypePriority.Low;
            case RecordType.CanNotParticipateInSport:
                return RecordTypePriority.Low;
            case RecordType.SpecialSocialCare:
                return RecordTypePriority.Medium;
            case RecordType.NoPermissionForMedicines:
                return RecordTypePriority.High;
            case RecordType.FinancialProblems:
                return RecordTypePriority.High;
            case RecordType.Other:
                return RecordTypePriority.Medium;
        }
    }
}
