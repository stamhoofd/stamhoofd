export enum Gender {
    Male = 'Male',
    Female = 'Female',
    Other = 'Other',
}

export function getGenderName(gender: Gender) {
    switch (gender) {
        case Gender.Male:
            return $t(`f972abd4-de1e-484b-b7da-ad4c75d37808`);
        case Gender.Female:
            return $t(`e21f499d-1078-4044-be5d-6693d2636699`);
        default:
            return $t(`60f13ba4-c6c9-4388-9add-43a996bf6bee`);
    }
}
