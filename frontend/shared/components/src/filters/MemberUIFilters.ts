import {GroupUIFilterBuilder} from "./GroupUIFilter"
import { StringFilterBuilder } from "./StringUIFilter";
import { UIFilterBuilder } from "./UIFilter";

export const memberUIFilterBuilders: UIFilterBuilder[] = [
    new StringFilterBuilder({
        name: 'Naam',
        key: 'name'
    }),
    new StringFilterBuilder({
        name: 'Naam vereniging',
        key: 'organizationName'
    })
];

// Recursive: self referencing groups
memberUIFilterBuilders.unshift(
    new GroupUIFilterBuilder({
        builders: memberUIFilterBuilders
    })
)