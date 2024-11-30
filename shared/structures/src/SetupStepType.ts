export enum SetupStepType {
    Responsibilities = 'Functions',
    Companies = 'Companies',
    Groups = 'Groups',
    Premises = 'Premises',
    Emails = 'Emails',
    Payment = 'Payment',
    Registrations = 'Registrations',
}

export function getSetupStepName(step: SetupStepType) {
    switch (step) {
        case SetupStepType.Responsibilities:
            return 'functies';
        case SetupStepType.Companies:
            return 'facturatiegegevens';
        case SetupStepType.Groups:
            return 'leeftijdsgroepen';
        case SetupStepType.Premises:
            return 'lokalen';
        case SetupStepType.Emails:
            return 'e-mailadressen';
        case SetupStepType.Payment:
            return 'betaalinstellingen';
        case SetupStepType.Registrations:
            return 'inschrijvingen';
    }
}
