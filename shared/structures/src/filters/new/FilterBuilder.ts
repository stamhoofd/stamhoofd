import { PlainObject } from "@simonbackx/simple-encoding";

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
}

export class StringFilterBuilder implements FilterBuilder {
    key = "";
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
        return `${this.key} bevat ${this.value}`
    }
}

export class StringFilterBuilderDefinition implements FilterBuilderDefinition<StringFilterBuilder> {
    key: string;
    
    constructor(key: string) {
        this.key = key;
    }
    
    create(): StringFilterBuilder {
        return new StringFilterBuilder({
            key: this.key,
            value: ''
        })
    }
}

const memberFilterBuilders: FilterBuilderDefinition[] = [
    new StringFilterBuilderDefinition({
        key: 'name',
        title: 'Naam'
    }),
    new GroupFilterBuilder()
];

const nameFilter = new StringFilterBuilderDefinition({
    key: 'name',
    title: 'Naam'
})