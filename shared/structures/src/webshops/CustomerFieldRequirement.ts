export enum CustomerFieldRequirement {
    Required = 'Required',
    Optional = 'Optional',
    Disabled = 'Disabled',
}

export function getCustomerFieldRequirementName(requirement: CustomerFieldRequirement): string {
    switch (requirement) {
        case CustomerFieldRequirement.Required: return $t('Verplicht');
        case CustomerFieldRequirement.Optional: return $t('Optioneel');
        case CustomerFieldRequirement.Disabled: return $t('Niet vragen');
    }
}
