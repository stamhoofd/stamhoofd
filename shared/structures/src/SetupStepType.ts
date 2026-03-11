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
            return $t(`%14U`);
        case SetupStepType.Companies:
            return $t(`%14V`);
        case SetupStepType.Groups:
            return $t(`%14W`);
        case SetupStepType.Premises:
            return $t(`%14X`);
        case SetupStepType.Emails:
            return $t(`%nI`);
        case SetupStepType.Payment:
            return $t(`%nJ`);
        case SetupStepType.Registrations:
            return $t(`%14Y`);
    }
}
