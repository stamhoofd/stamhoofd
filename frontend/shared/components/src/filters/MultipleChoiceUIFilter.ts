import { ComponentWithProperties } from '@simonbackx/vue-app-navigation';
import { StamhoofdCompareValue, StamhoofdFilter, WrapperFilter } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';

import MultipleChoiceUIFilterView from './MultipleChoiceUIFilterView.vue';
import { StyledDescription, UIFilter, UIFilterBuilder, UiFilterOptions, UIFilterUnwrapper, UIFilterWrapper, unwrapFilterForBuilder } from './UIFilter';

export class MultipleChoiceUIFilterOption {
    name: string;
    value: StamhoofdCompareValue;

    constructor(name: string, value: StamhoofdCompareValue) {
        this.name = name;
        this.value = value;
    }
}

export enum MultipleChoiceUIFilterMode {
    And = 'And',
    Or = 'Or',
}

export class MultipleChoiceUIFilter extends UIFilter {
    builder: MultipleChoiceFilterBuilder;
    selectedOptions: MultipleChoiceUIFilterOption[] = [];
    configuration: MultipleChoiceUiFilterConfiguration;

    constructor(data: Partial<UIFilter>, options: UiFilterOptions, multipleChoiceConfiguration: MultipleChoiceUiFilterConfiguration) {
        super(data, options);

        this.configuration = multipleChoiceConfiguration;
    }

    doBuild(): StamhoofdFilter {
        return this.selectedOptions.map(o => o.value);
    }

    flatten() {
        if (this.selectedOptions.length === 0) {
            return null;
        }

        return super.flatten();
    }

    getComponent(): ComponentWithProperties {
        return new ComponentWithProperties(MultipleChoiceUIFilterView, {
            filter: this,
        });
    }

    override get styledDescription(): StyledDescription {
        const { mode, isSubjectPlural } = this.configuration;
        const lastJoinWord = mode === MultipleChoiceUIFilterMode.Or ? 'of' : 'en';

        return [
            {
                text: this.builder.name,
                style: '',
            },
            {
                text: '',
                style: '',
                choices: [
                    {
                        id: 'is',
                        text: isSubjectPlural ? 'zijn' : 'is',
                        action: () => {
                            this.isInverted = false;
                        },
                        isSelected: () => !this.isInverted,
                    },
                    {
                        id: 'is not',
                        text: isSubjectPlural ? 'zijn niet' : 'is niet',
                        action: () => {
                            this.isInverted = true;
                        },
                        isSelected: () => this.isInverted,
                    },
                ],
            },
            {
                text: Formatter.joinLast(this.selectedOptions.map(o => o.name), ', ', ` ${lastJoinWord} `),
                style: '',
            },
        ];
    }
}

export type MultipleChoiceUiFilterConfiguration = {
    mode: MultipleChoiceUIFilterMode;
    isSubjectPlural: boolean;
    showOptionSelectAll: boolean;
};

export class MultipleChoiceFilterBuilder implements UIFilterBuilder<MultipleChoiceUIFilter> {
    name = '';
    wrapper?: WrapperFilter;
    additionalUnwrappers?: WrapperFilter[];
    wrapFilter?: UIFilterWrapper | null | undefined;
    unwrapFilter?: UIFilterUnwrapper | null | undefined;
    allowCreation?: boolean | undefined;

    multipleChoiceOptions: MultipleChoiceUIFilterOption[] = [];
    multipleChoiceConfiguration: MultipleChoiceUiFilterConfiguration = {
        mode: MultipleChoiceUIFilterMode.Or,
        isSubjectPlural: false,
        showOptionSelectAll: false,
    };

    constructor(data: {
        name: string;
        options: MultipleChoiceUIFilterOption[];
        wrapper?: WrapperFilter;
        additionalUnwrappers?: WrapperFilter[];
        wrapFilter?: UIFilterWrapper | null | undefined;
        unwrapFilter?: UIFilterUnwrapper | null | undefined;
        multipleChoiceConfiguration?: Partial<MultipleChoiceUiFilterConfiguration>;
        allowCreation?: boolean;
    }) {
        this.name = data.name;
        this.multipleChoiceOptions = data.options;
        this.wrapper = data.wrapper;
        this.wrapFilter = data.wrapFilter;
        this.unwrapFilter = data.unwrapFilter;
        this.additionalUnwrappers = data.additionalUnwrappers;
        this.allowCreation = data.allowCreation;

        const multipleChoiceConfiguration = data.multipleChoiceConfiguration;
        if (multipleChoiceConfiguration) {
            const { mode, isSubjectPlural, showOptionSelectAll } = multipleChoiceConfiguration;

            if (mode !== undefined) {
                this.multipleChoiceConfiguration.mode = mode;
            }
            if (isSubjectPlural !== undefined) {
                this.multipleChoiceConfiguration.isSubjectPlural = isSubjectPlural;
            }
            if (showOptionSelectAll !== undefined) {
                this.multipleChoiceConfiguration.showOptionSelectAll = showOptionSelectAll;
            }
        }
    }

    fromFilter(filter: StamhoofdFilter): UIFilter | null {
        const match = unwrapFilterForBuilder(this, filter);
        if (!match.match || match.markerValue === undefined) {
            return null;
        }
        const response = match.markerValue;

        if (Array.isArray(response)) {
            // Check if all the options are valid
            const options = this.multipleChoiceOptions.filter(o => response.includes(o.value));

            if (options.length === response.length) {
                const uiFilter = new MultipleChoiceUIFilter({
                    builder: this,
                }, { isInverted: match.isInverted }, this.multipleChoiceConfiguration);
                uiFilter.selectedOptions = options;

                return uiFilter;
            }
        }

        const option = this.multipleChoiceOptions.find(o => o.value === response);
        if (option) {
            const uiFilter = new MultipleChoiceUIFilter({
                builder: this,
            }, { isInverted: match.isInverted }, this.multipleChoiceConfiguration);
            uiFilter.selectedOptions = [option];

            return uiFilter;
        }

        return null;
    }

    create(options: { isInverted?: boolean } = {}): MultipleChoiceUIFilter {
        return new MultipleChoiceUIFilter({
            builder: this,
        }, options, this.multipleChoiceConfiguration);
    }
}
