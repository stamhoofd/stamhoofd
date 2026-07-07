import { describe, expect, test } from 'vitest';
import type { RelationFilterOption } from './RelationUIFilter';
import { getRelationFilterDisplayOptions } from './relationFilterOptions';

function option(name: string, value = name): RelationFilterOption<string> {
    return { name, value };
}

function names(options: RelationFilterOption<string>[]) {
    return options.map(o => o.name);
}

function getVisibleNames(options: ReturnType<typeof getRelationFilterDisplayOptions<string>>) {
    return names(options.pinnedOptions.concat(options.regularOptions));
}

describe('getRelationFilterDisplayOptions', () => {
    test('keeps a selected visible async option in async order', () => {
        const result = getRelationFilterDisplayOptions({
            defaultOptions: [],
            selectedOptions: [option('Group B')],
            asyncOptions: [option('Group A'), option('Group B'), option('Group C')],
        });

        expect(names(result.pinnedOptions)).toEqual([]);
        expect(getVisibleNames(result)).toEqual(['Group A', 'Group B', 'Group C']);
    });

    test('pins a selected option that is not currently visible in async options', () => {
        const result = getRelationFilterDisplayOptions({
            defaultOptions: [],
            selectedOptions: [option('Group D')],
            asyncOptions: [option('Group A'), option('Group B'), option('Group C')],
        });

        expect(names(result.pinnedOptions)).toEqual(['Group D']);
        expect(getVisibleNames(result)).toEqual(['Group D', 'Group A', 'Group B', 'Group C']);
    });

    test('keeps default options pinned before async options', () => {
        const result = getRelationFilterDisplayOptions({
            defaultOptions: [option('No group', 'none')],
            selectedOptions: [],
            asyncOptions: [option('Group A'), option('Group B')],
        });

        expect(names(result.pinnedOptions)).toEqual(['No group']);
        expect(getVisibleNames(result)).toEqual(['No group', 'Group A', 'Group B']);
    });

    test('does not duplicate default options that are also in async options', () => {
        const result = getRelationFilterDisplayOptions({
            defaultOptions: [option('No group', 'none')],
            selectedOptions: [],
            asyncOptions: [option('No group', 'none'), option('Group A')],
        });

        expect(getVisibleNames(result)).toEqual(['No group', 'Group A']);
    });

    test('does not duplicate selected default options', () => {
        const result = getRelationFilterDisplayOptions({
            defaultOptions: [option('No group', 'none')],
            selectedOptions: [option('No group', 'none'), option('Group D')],
            asyncOptions: [option('Group A')],
        });

        expect(names(result.pinnedOptions)).toEqual(['No group', 'Group D']);
        expect(getVisibleNames(result)).toEqual(['No group', 'Group D', 'Group A']);
    });

    test('uses only value when checking for duplicate options', () => {
        const result = getRelationFilterDisplayOptions({
            defaultOptions: [],
            selectedOptions: [option('Old name', '1')],
            asyncOptions: [option('New name', '1')],
        });

        expect(getVisibleNames(result)).toEqual(['New name']);
    });
});
