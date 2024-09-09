import { useTranslate } from "@stamhoofd/frontend-i18n";
import { SetupStepType } from "@stamhoofd/structures";

export function useSetupStepTranslations(): {
    getReviewTitle: (type: SetupStepType) => string,
    getReviewDescription: (type: SetupStepType) => string,
    getReviewCheckboxTitle: (type: SetupStepType) => string,
    getTodoTitle: (type: SetupStepType) => string,
    getTodoDescription: (type: SetupStepType) => string
} {
    const $t = useTranslate();

    const reviewTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('setup.Functions.review.title'),
        [SetupStepType.Companies]: $t('setup.Companies.review.title'),
        [SetupStepType.Groups]: $t('setup.Groups.review.title'),
        [SetupStepType.Premises]: $t('setup.Premises.review.title'),
        [SetupStepType.Emails]: $t('setup.Emails.review.title'),
        [SetupStepType.Payment]: $t('setup.Payment.review.title'),
    }

    const reviewDescriptionMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('setup.Functions.review.description'),
        [SetupStepType.Companies]: $t('setup.Companies.review.description'),
        [SetupStepType.Groups]: $t('setup.Groups.review.description'),
        [SetupStepType.Premises]: $t('setup.Premises.review.description'),
        [SetupStepType.Emails]: $t('setup.Emails.review.description'),
        [SetupStepType.Payment]: $t('setup.Payment.review.description'),
    }

    const reviewCheckboxTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('setup.Functions.review.checkboxTitle'),
        [SetupStepType.Companies]: $t('setup.Companies.review.checkboxTitle'),
        [SetupStepType.Groups]: $t('setup.Groups.review.checkboxTitle'),
        [SetupStepType.Premises]: $t('setup.Premises.review.checkboxTitle'),
        [SetupStepType.Emails]: $t('setup.Emails.review.checkboxTitle'),
        [SetupStepType.Payment]: $t('setup.Payment.review.checkboxTitle'),
    }

    const todoTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('setup.Functions.todo.title'),
        [SetupStepType.Companies]: $t('setup.Companies.todo.title'),
        [SetupStepType.Groups]: '',
        [SetupStepType.Premises]: $t('setup.Premises.todo.title'),
        [SetupStepType.Emails]: $t('setup.Emails.todo.title'),
        [SetupStepType.Payment]: $t('setup.Payment.todo.title'),
    }

    const todoDescriptionMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('setup.Functions.todo.description'),
        [SetupStepType.Companies]: $t('setup.Companies.todo.description'),
        [SetupStepType.Groups]: '',
        [SetupStepType.Premises]: $t('setup.Premises.todo.description'),
        [SetupStepType.Emails]: $t('setup.Emails.todo.description'),
        [SetupStepType.Payment]: $t('setup.Payment.todo.description'),
    }

    const getReviewTitle = (type: SetupStepType): string => {
        return reviewTitleMap[type]
    }

    const getReviewDescription = (type: SetupStepType): string => {
        return reviewDescriptionMap[type]
    }

    const getReviewCheckboxTitle = (type: SetupStepType): string => {
        return reviewCheckboxTitleMap[type]
    }

    const getTodoTitle = (type: SetupStepType): string => {
        return todoTitleMap[type]
    }

    const getTodoDescription = (type: SetupStepType): string => {
        return todoDescriptionMap[type]
    }

    return {
        getReviewTitle,
        getReviewDescription,
        getReviewCheckboxTitle,
        getTodoTitle,
        getTodoDescription
    }
}
