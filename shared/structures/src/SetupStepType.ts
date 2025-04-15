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
            return $t(`functies`);
        case SetupStepType.Companies:
            return $t(`facturatiegegevens`);
        case SetupStepType.Groups:
            return $t(`leeftijdsgroepen`);
        case SetupStepType.Premises:
            return $t(`lokalen`);
        case SetupStepType.Emails:
            return $t(`e-mailadressen`);
        case SetupStepType.Payment:
            return $t(`betaalinstellingen`);
        case SetupStepType.Registrations:
            return $t(`inschrijvingen`);
    }
}
