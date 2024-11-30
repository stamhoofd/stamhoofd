export enum Gender {
    Male = 'Male',
    Female = 'Female',
    Other = 'Other',
}

export function getGenderName(gender: Gender) {
    switch (gender) {
        case Gender.Male:
            return 'Man';
        case Gender.Female:
            return 'Vrouw';
        case Gender.Other:
            return 'Andere';
    }
}
