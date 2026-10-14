import type { WrapperFilter } from '@stamhoofd/structures';
import type { UIFilter, UIFilterBuilder } from './UIFilter';

export enum GroupUIFilterMode {
    Or = 'Or',
    And = 'And',
}

export interface GroupUIFilterBuilderEditor extends UIFilterBuilder {
    builders: UIFilterBuilder[];
    description: string;
    wrapper?: WrapperFilter;
}

export interface GroupUIFilterEditor extends UIFilter {
    filters: UIFilter[];
    mode: GroupUIFilterMode;
    builders: UIFilterBuilder[];
    builder: GroupUIFilterBuilderEditor;
    clone(): GroupUIFilterEditor;
}

export interface GroupUIFilterEditorProperties {
    filter: GroupUIFilterEditor;
    isGroupFilter: (filter: UIFilter) => filter is GroupUIFilterEditor;
    isGroupBuilder: (builder: UIFilterBuilder) => boolean;
}
