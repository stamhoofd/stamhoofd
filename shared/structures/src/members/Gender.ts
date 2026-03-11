export enum Gender {
    Male = 'Male',
    Female = 'Female',
    Other = 'Other',
}

export function getGenderName(gender: Gender) {
    switch (gender) {
        case Gender.Male:
            return $t(`b54b9706-4c0c-46a6-9027-37052eb76b28`);
        case Gender.Female:
            return $t(`06466432-eca6-41d0-a3d6-f262f8d6d2ac`);
        default:
            return $t(`26677608-996f-41a5-8a53-543d6efa7de4`);
    }
}
