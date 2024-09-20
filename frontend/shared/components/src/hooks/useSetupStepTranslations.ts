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
        [SetupStepType.Responsibilities]: $t('1d0d59b8-d7bf-4f04-846f-5025d7de7b4e'),
        [SetupStepType.Companies]: $t('31df7737-2a25-4a6c-9766-39acc3ccdbc8'),
        [SetupStepType.Groups]: $t('11ad8aa2-5aea-400b-8fe1-90e8495c1395'),
        [SetupStepType.Premises]: $t('19cc6e71-9cd7-41d8-84d0-2c8828bd92c4'),
        [SetupStepType.Emails]: $t('7e68086e-0dcc-445a-a639-984f1a7298ad'),
        [SetupStepType.Payment]: $t('db69887c-b23a-4779-b945-cbe5d02856a7'),
        [SetupStepType.Registrations]: $t('Schrijf leden in')
    }

    const reviewDescriptionMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('96c10e6b-3974-40d4-8844-70b0b2fa110e'),
        [SetupStepType.Companies]: $t('0712bc3b-15d5-4678-be41-8d168e5d52cf'),
        [SetupStepType.Groups]: $t('c965f4a7-4dc3-4201-961e-65f1a9eb7f89'),
        [SetupStepType.Premises]: $t('03ffd28c-99d4-4bae-8494-5def382d826e'),
        [SetupStepType.Emails]: $t('9eb28669-42a5-4211-b72f-3335c0d4b329'),
        [SetupStepType.Payment]: $t('70894bb8-da5a-4f1a-929d-08f4479c4de3'),
        [SetupStepType.Registrations]: $t('Schrijf minstens één lid in per standaard leeftijdsgroep.')
    }

    const reviewCheckboxTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('1ee738ae-a91d-474e-a495-996bf431126a'),
        [SetupStepType.Companies]: $t('f5404f0c-96f7-4f6a-834d-7616bfbedaf3'),
        [SetupStepType.Groups]: $t('3124147c-09cf-4a87-8ae8-9545b90c1ba4'),
        [SetupStepType.Premises]: $t('0d7093d6-d3c0-412e-af8a-d44a5d2394d9'),
        [SetupStepType.Emails]: $t('c136101a-cd7e-4b04-9c81-e17f03a511d1'),
        [SetupStepType.Payment]: $t('b831d108-6aa9-4e6e-97ce-9f50a1cab9e1'),
        [SetupStepType.Registrations]: $t('Schrijf leden in')
    }

    const todoTitleMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('268546f2-5dd0-492c-8680-e93b5d40807d'),
        [SetupStepType.Companies]: $t('5a8403bb-90f8-4722-8cad-b275ffa781d9'),
        [SetupStepType.Groups]: '',
        [SetupStepType.Premises]: $t('5c37d309-63da-44af-8eec-fb593b8bad31'),
        [SetupStepType.Emails]: $t('da415fb3-06f2-45eb-9230-ef56bcd52970'),
        [SetupStepType.Payment]: $t('8587ff64-b9b5-4e57-84b1-4afd342ffec3'),
        [SetupStepType.Registrations]: $t('Schrijf leden in')
    }

    const todoDescriptionMap: Record<SetupStepType, string> = {
        [SetupStepType.Responsibilities]: $t('f3236c83-b7ba-453f-981a-3e06925c9b7a'),
        [SetupStepType.Companies]: $t('457fc4b2-9145-45c8-aba3-1fd629317330'),
        [SetupStepType.Groups]: '',
        [SetupStepType.Premises]: $t('05afcd20-5dda-4e01-88a7-e58d46487d30'),
        [SetupStepType.Emails]: $t('9ef3cbb3-93bb-4f77-93af-3752ff869894'),
        [SetupStepType.Payment]: $t('953003c6-6653-4cef-a2ca-09723658b828'),
        [SetupStepType.Registrations]: $t('Schrijf minstens één lid in per standaard leeftijdsgroep.')
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
