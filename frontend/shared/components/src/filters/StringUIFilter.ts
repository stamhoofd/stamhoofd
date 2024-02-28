import { PlainObject } from "@simonbackx/simple-encoding";
import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter, StringFilterMode } from "@stamhoofd/structures";

import StringUIFilterView from "./StringUIFilterView.vue"
import { UIFilter, UIFilterBuilder } from "./UIFilter";

export class StringUIFilter extends UIFilter {
    key = "";
    name = ""
    value = ""
    mode: StringFilterMode = StringFilterMode.Contains

    build(): StamhoofdFilter {
        switch (this.mode) {
            case StringFilterMode.Contains: return {
                [this.key]: {
                    "$contains": this.value
                }
            };

            case StringFilterMode.NotContains: return {
                $not: {
                    [this.key]: {
                        "$contains": this.value
                    }
                }
            };

            case StringFilterMode.Equals: return {
                [this.key]: {
                    "$eq": this.value
                }
            };

            case StringFilterMode.NotEquals: return {
                $not: {
                    [this.key]: {
                        "$eq": this.value
                    }
                }
            };

            case StringFilterMode.Empty: return {
                $or: {
                    [this.key]: {
                        "$eq": ''
                    },
                    [this.key]: {
                        "$eq": null
                    }
                }
            };

            case StringFilterMode.NotEmpty: return {
                $not: {
                    $or: {
                        [this.key]: {
                            "$eq": ''
                        },
                        [this.key]: {
                            "$eq": null
                        }
                    }
                }
            };
        }
    }

    constructor(data) {
        super()
        Object.assign(this, data);
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(StringUIFilterView, {
            filter: this
        })
    }

    get combinationWord(): string {
        switch (this.mode) {
            case StringFilterMode.Contains: return 'bevat';
            case StringFilterMode.NotContains: return 'bevat niet';
            case StringFilterMode.Equals: return 'is gelijk aan';
            case StringFilterMode.NotEquals: return 'is niet gelijk aan';
            case StringFilterMode.Empty: return 'is leeg';
            case StringFilterMode.NotEmpty: return 'is niet leeg';
        }
    }

    get ignoreValue(): boolean {
        switch (this.mode) {
            case StringFilterMode.Empty: return true;
            case StringFilterMode.NotEmpty: return true;
        }
        return false;
    }

    get styledDescription() {
        if (this.ignoreValue) {
            return [
                {
                    text: this.name,
                    style: ''
                },
                {
                    text: ' '+ this.combinationWord,
                    style: 'gray'
                }
            ]
        }

        return [
            {
                text: this.name,
                style: ''
            },
            {
                text: ' '+ this.combinationWord +' ',
                style: 'gray'
            }, {
                text: this.value,
                style: ''
            }
        ]
    }
}

export class StringFilterBuilder implements UIFilterBuilder<StringUIFilter> {
    key: string;
    name = ""
    
    constructor(data: {name: string, key: string}) {
        this.key = data.key;
        this.name = data.name;
    }
    
    create(): StringUIFilter {
        return new StringUIFilter({
            key: this.key,
            name: this.name,
            value: ''
        })
    }
}