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