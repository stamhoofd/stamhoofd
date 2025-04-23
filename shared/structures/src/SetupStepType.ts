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
            return $t(`96e61729-ea9c-45bf-82da-56e6a92e6b91`);
        case SetupStepType.Companies:
            return $t(`d7fdebd4-7c3c-4316-b862-7ed777ff36ad`);
        case SetupStepType.Groups:
            return $t(`f7999a55-e73a-49c4-ac9f-f5030d96ba43`);
        case SetupStepType.Premises:
            return $t(`e122d6c9-a452-4c70-9868-f53c2520aedc`);
        case SetupStepType.Emails:
            return $t(`2fd98822-82eb-4f50-9396-5ddf9aa54a33`);
        case SetupStepType.Payment:
            return $t(`5df07dee-5d57-452a-b79b-844e1dc2db71`);
        case SetupStepType.Registrations:
            return $t(`4070dda9-b556-49cd-ba17-aad535240835`);
    }
}
