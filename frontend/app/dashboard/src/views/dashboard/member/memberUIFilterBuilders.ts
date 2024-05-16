import { GroupUIFilterBuilder, StringFilterBuilder, UIFilterBuilders } from "@stamhoofd/components";

export const memberUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres lid',
        key: 'email'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres ouder',
        key: 'parentEmail'
    })
];

// Recursive: self referencing groups
memberUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberUIFilterBuilders
    })
)
