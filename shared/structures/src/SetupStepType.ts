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
            return $t(`d483a129-031a-4cfd-8cac-16a34134aad0`);
        case SetupStepType.Companies:
            return $t(`c1dbdfd0-5111-4b1b-859b-95c8f30ad132`);
        case SetupStepType.Groups:
            return $t(`4e226f0b-e81f-4e27-b352-073fc4744c18`);
        case SetupStepType.Premises:
            return $t(`85125d9c-6a30-4211-830a-8aa9a2c75fc0`);
        case SetupStepType.Emails:
            return $t(`2fd98822-82eb-4f50-9396-5ddf9aa54a33`);
        case SetupStepType.Payment:
            return $t(`5df07dee-5d57-452a-b79b-844e1dc2db71`);
        case SetupStepType.Registrations:
            return $t(`8cf35f34-4cbb-4eb5-93cd-308ab22adf56`);
    }
}
