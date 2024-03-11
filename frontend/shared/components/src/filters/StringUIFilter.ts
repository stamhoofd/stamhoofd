import { ComponentWithProperties } from "@simonbackx/vue-app-navigation";
import { StamhoofdFilter, StringFilterMode } from "@stamhoofd/structures";

import StringUIFilterView from "./StringUIFilterView.vue";
import { UIFilter, UIFilterBuilder } from "./UIFilter";

export class StringUIFilter extends UIFilter {
    builder: StringFilterBuilder
    value = ""
    mode: StringFilterMode = StringFilterMode.Contains

    doBuild(): StamhoofdFilter {
        switch (this.mode) {
            case StringFilterMode.Contains: return {
                [this.builder.key]: {
                    "$contains": this.value
                }
            };

            case StringFilterMode.NotContains: return {
                $not: {
                    [this.builder.key]: {
                        "$contains": this.value
                    }
                }
            };

            case StringFilterMode.Equals: return {
                [this.builder.key]: {
                    "$eq": this.value
                }
            };

            case StringFilterMode.NotEquals: return {
                $not: {
                    [this.builder.key]: {
                        "$eq": this.value
                    }
                }
            };

            case StringFilterMode.Empty: return {
                $or: [
                    {
                        [this.builder.key]: {
                            "$eq": ''
                        }
                    },
                    {
                        [this.builder.key]: {
                            "$eq": null
                        }
                    }
                ]
            };

            case StringFilterMode.NotEmpty: return {
                $not: {
                    $or: [
                        {
                            [this.builder.key]: {
                                "$eq": ''
                            }
                        },
                        {
                            [this.builder.key]: {
                                "$eq": null
                            }
                        }
                    ]
                }
            };
        }
    }

    flatten() {
        if (this.mode === StringFilterMode.Equals && this.value === '') {
            this.mode = StringFilterMode.Empty
        }
        if (this.mode === StringFilterMode.NotEquals && this.value === '') {
            this.mode = StringFilterMode.NotEmpty
        }

        return super.flatten()
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
                    text: this.builder.name,
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
                text: this.builder.name,
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
type FilterWrapper = ((value: StamhoofdFilter) => StamhoofdFilter);

export class StringFilterBuilder implements UIFilterBuilder<StringUIFilter> {
    key = ""
    name = ""
    wrapFilter?: FilterWrapper

    constructor(data: {key: string, name: string, wrapFilter?: FilterWrapper}) {
        this.key = data.key;
        this.wrapFilter = data.wrapFilter;
        this.name = data.name;
    }
    
    create(): StringUIFilter {
        return new StringUIFilter({
            builder: this,
            value: ''
        })
    }
}