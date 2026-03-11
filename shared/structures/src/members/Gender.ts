export enum Gender {
    Male = 'Male',
    Female = 'Female',
    Other = 'Other',
}

export function getGenderName(gender: Gender) {
    switch (gender) {
        case Gender.Male:
            return $t(`%XK`);
        case Gender.Female:
            return $t(`%XM`);
        default:
            return $t(`%1JG`);
    }
}
