import { SetupStepType } from '@stamhoofd/structures';

export function useSetupStepTranslations(): {
    getReviewTitle: (type: SetupStepType) => string;
    getReviewDescription: (type: SetupStepType) => string;
    getReviewCheckboxTitle: (type: SetupStepType) => string;
    getTodoTitle: (type: SetupStepType) => string;
    getTodoDescription: (type: SetupStepType) => string;
} {
    const reviewTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%4i'),
        [SetupStepType.Companies]: $t('%4d'),
        [SetupStepType.Groups]: $t('%4n'),
        [SetupStepType.Premises]: $t('%4q'),
        [SetupStepType.Emails]: $t('%4v'),
        [SetupStepType.Payment]: $t('%4y'),
        [SetupStepType.Registrations]: $t('%6f'),
    };

    const reviewDescriptionMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%4h'),
        [SetupStepType.Companies]: $t('%4c'),
        [SetupStepType.Groups]: $t('%4m'),
        [SetupStepType.Premises]: $t('%4p'),
        [SetupStepType.Emails]: $t('%4u'),
        [SetupStepType.Payment]: $t('%4x'),
        [SetupStepType.Registrations]: $t('%6g'),
    };

    const reviewCheckboxTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%4j'),
        [SetupStepType.Companies]: $t('%4e'),
        [SetupStepType.Groups]: $t('%4o'),
        [SetupStepType.Premises]: $t('%4r'),
        [SetupStepType.Emails]: $t('%4w'),
        [SetupStepType.Payment]: $t('%4z'),
        [SetupStepType.Registrations]: $t('%6f'),
    };

    const todoTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%4l'),
        [SetupStepType.Companies]: $t('%4g'),
        [SetupStepType.Groups]: '',
        [SetupStepType.Premises]: $t('%4t'),
        [SetupStepType.Emails]: $t('%4v'),
        [SetupStepType.Payment]: $t('%51'),
        [SetupStepType.Registrations]: $t('%6f'),
    };

    const todoDescriptionMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('%4k'),
        [SetupStepType.Companies]: $t('%4f'),
        [SetupStepType.Groups]: '',
        [SetupStepType.Premises]: $t('%4s'),
        [SetupStepType.Emails]: $t('%4u'),
        [SetupStepType.Payment]: $t('%50'),
        [SetupStepType.Registrations]: $t('%6g'),
    };

    const getReviewTitle = (type: SetupStepType): string => {
        return reviewTitleMap[type];
    };

    const getReviewDescription = (type: SetupStepType): string => {
        return reviewDescriptionMap[type];
    };

    const getReviewCheckboxTitle = (type: SetupStepType): string => {
        return reviewCheckboxTitleMap[type];
    };

    const getTodoTitle = (type: SetupStepType): string => {
        return todoTitleMap[type];
    };

    const getTodoDescription = (type: SetupStepType): string => {
        return todoDescriptionMap[type];
    };

    return {
        getReviewTitle,
        getReviewDescription,
        getReviewCheckboxTitle,
        getTodoTitle,
        getTodoDescription,
    };
}
