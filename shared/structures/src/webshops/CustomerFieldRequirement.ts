export enum CustomerFieldRequirement {
    Required = 'Required',
    Optional = 'Optional',
    Disabled = 'Disabled',
}

export function getCustomerFieldRequirementName(requirement: CustomerFieldRequirement): string {
    switch (requirement) {
        case CustomerFieldRequirement.Required: return $t('%Qk');
        case CustomerFieldRequirement.Optional: return $t('%14p');
        case CustomerFieldRequirement.Disabled: return $t('%Zr4');
    }
}
