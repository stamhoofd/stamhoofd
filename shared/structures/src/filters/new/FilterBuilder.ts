import { PlainObject } from "@simonbackx/simple-encoding";
import { Formatter } from "@stamhoofd/utility";

import { StringFilterMode } from "../StringFilter";

export interface FilterBuilderDefinition<Builder extends FilterBuilder = FilterBuilder> {
    create(): Builder
}

export interface FilterBuilder {
    build(): PlainObject
    get description(): string
}


export class GroupFilterBuilder implements FilterBuilder {
    groupIds: string[] = []

    build(): PlainObject {
        return {
            registrations: [
                {
                    groupId: {
                        '$in': this.groupIds
                    },
                    waitingList: false,
                    registeredAt: {
                        '$neq': null
                    }
                }
            ]
        };
    }

    constructor(data) {
        Object.assign(this, data);
    }

    get description() {
        return 'Ingeschreven voor x en y'
    }

    static create() {
        return new GroupFilterBuilder({})
    }
}

export class StringFilterBuilder implements FilterBuilder {
    key = "";
    name = ""
    value = ""
    mode: StringFilterMode = StringFilterMode.Contains

    build(): PlainObject {
        return {
            [this.key]: {
                "$contains": this.value
            }
        };
    }

    constructor(data) {
        Object.assign(this, data);
    }

    get description() {
        return `${this.name} bevat ${this.value}`
    }
}

export class StringFilterBuilderDefinition implements FilterBuilderDefinition<StringFilterBuilder> {
    key: string;
    name = ""
    
    constructor(data: {name: string, key: string}) {
        this.key = data.key;
        this.name = data.name;
    }
    
    create(): StringFilterBuilder {
        return new StringFilterBuilder({
            key: this.key,
            name: this.name,
            value: ''
        })
    }
}

export class GroupedFiltersBuilder implements FilterBuilder {
    definitions: FilterBuilderDefinition[] = []
    builders: FilterBuilder[] = []

    build(): PlainObject {
        return {
            '$and': this.builders.map(b => b.build())
        };
    }

    constructor(data) {
        Object.assign(this, data);
    }

    get description() {
        return Formatter.joinLast(this.builders.map(b => b.description), ', ', ' en ')
    }
}


export class GroupedFiltersBuilderDefinition implements FilterBuilderDefinition<GroupedFiltersBuilder> {
    definitions: FilterBuilderDefinition[]
    
    constructor(definitions: FilterBuilderDefinition[]) {
        this.definitions = definitions
    }
    
    create(): GroupedFiltersBuilder {
        return new GroupedFiltersBuilder({
            definitions: this.definitions
        })
    }
}


const memberFilterBuilders: FilterBuilderDefinition[] = [
    new StringFilterBuilderDefinition({
        key: 'name',
        name: 'Naam'
    }),
    GroupFilterBuilder
];

// Recursive: self referencing groups
memberFilterBuilders.push(
    new GroupedFiltersBuilderDefinition(memberFilterBuilders)
)