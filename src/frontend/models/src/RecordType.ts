export enum RecordType {
    // Privacy
    NoData = "NoData",
    NoPictures = "NoPictures",

    // Allergies & diet
    FoodAllergies = "FoodAllergies",
    MedicineAllergies = "MedicineAllergies",
    OtherAllergies = "OtherAllergies",
    Diet = "Diet",

    // Health, hygiene and sleep
    Asthma = "Asthma",
    BedWaters = "BedWaters",
    Epilepsy = "Epilepsy",
    HeartDisease = "HeartDisease",
    HayFever = "HayFever",
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
            case RecordType.FoodAllergies:
                return "Allergisch voor noten";
            case RecordType.MedicineAllergies:
                return "Allergisch voor paracetamol";
            case RecordType.OtherAllergies:
                return "Allergisch voor verf";
            case RecordType.Diet:
                return "Vegetarisch";
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

    static getPriority(type: RecordType): string {
        switch (type) {
            case RecordType.NoData:
                return RecordTypePriority.High;
            case RecordType.NoPictures:
                return RecordTypePriority.High;
            case RecordType.FoodAllergies:
                return RecordTypePriority.Medium;
            case RecordType.MedicineAllergies:
                return RecordTypePriority.Medium;
            case RecordType.OtherAllergies:
                return RecordTypePriority.Medium;
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
