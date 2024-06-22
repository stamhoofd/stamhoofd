import { Gender } from "../../../../../shared/structures/esm/dist/src/members/Gender";
import { GroupUIFilterBuilder } from "./GroupUIFilter";
import { MultipleChoiceFilterBuilder, MultipleChoiceUIFilterOption } from "./MultipleChoiceUIFilter";
import { NumberFilterBuilder } from "./NumberUIFilter";
import { StringFilterBuilder } from "./StringUIFilter";
import { UIFilterBuilders } from "./UIFilter";

// This one should match memberWithRegistrationsBlobInMemoryFilterCompilers
export const memberWithRegistrationsBlobUIFilterBuilders: UIFilterBuilders = [
    new NumberFilterBuilder({
        name: 'Leeftijd',
        key: 'age',
    }),
    new MultipleChoiceFilterBuilder({
        name: 'Gender',
        options: [
            new MultipleChoiceUIFilterOption('Vrouw', Gender.Female),
            new MultipleChoiceUIFilterOption('Man', Gender.Male),
            new MultipleChoiceUIFilterOption('Andere', Gender.Other)
        ],
        buildFilter: (choices) => {
            return {
                gender: {
                    $in: choices.map(c => c)
                }
            }
        }
    })
];

// Recursive: self referencing groups
memberWithRegistrationsBlobUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberWithRegistrationsBlobUIFilterBuilders
    })
)

//
// CHECKOUT
// 

// This one should match memberWithRegistrationsBlobInMemoryFilterCompilers
export const checkoutUIFilterBuilders: UIFilterBuilders = [
    // todo
];

// Recursive: self referencing groups
checkoutUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: checkoutUIFilterBuilders
    })
)

//
// ORGANIZATIONS
// 

const organizationMemberUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new StringFilterBuilder({
        name: 'Voornaam',
        key: 'firstName'
    }),
    new StringFilterBuilder({
        name: 'Achternaam',
        key: 'lastName'
    }),
    new StringFilterBuilder({
        name: 'E-mailadres',
        key: 'email'
    }),
]

export const organizationsUIFilterBuilders: UIFilterBuilders = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new GroupUIFilterBuilder({
        name: 'Leden',
        builders: organizationMemberUIFilterBuilders,
        wrapFilter: (f) => {
            return {
                members: {
                    $elemMatch: f
                }
            }
        },
    })
];

// Recursive: self referencing groups
organizationsUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: organizationsUIFilterBuilders
    })
)
