import type { GroupGenderType } from '../GroupGenderType.js';

export type MatchingGroup = {
    settings: {
        minAge: number | null;
        maxAge: number | null;
        startDate: Date | null;
        genderType: GroupGenderType;
        getAgeGenderDescription(options: { includeAge?: boolean; includeGender?: boolean }): string | null;
    };
};
