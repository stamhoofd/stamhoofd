import type { FilterCompiler, FilterDefinitions } from './FilterCompilers.js';
import { compileFilter, filterDefinitionsToCompiler } from './FilterCompilers.js';

describe('filter compiler registries', () => {
    const exact: FilterCompiler<string> = (_filter, _parent, key) => `exact:${key}`;
    const wildcard: FilterCompiler<string> = (_filter, _parent, key) => `wildcard:${key}`;

    it('uses only registered keys, including names shared with Object.prototype', () => {
        const definitions: FilterDefinitions<string> = new Map();
        const compiler = filterDefinitionsToCompiler(definitions);
        for (const key of ['constructor', 'toString', '__proto__']) {
            expect(compiler(null, compiler, key)).toBeUndefined();
            definitions.set(key, exact);
            expect(compileFilter({ [key]: null }, compiler)).toEqual([`exact:${key}`]);
        }
    });

    it('keeps exact dotted keys ahead of namespaces', () => {
        const namespace: FilterDefinitions<string> = new Map([['field', exact]]);
        const definitions: FilterDefinitions<string> = new Map<string, FilterCompiler<string> | FilterDefinitions<string>>([
            ['nested', namespace],
            ['nested.field', wildcard],
        ]);
        const compiler = filterDefinitionsToCompiler(definitions);
        expect(compileFilter({ 'nested.field': null }, compiler)).toEqual(['wildcard:nested.field']);
        definitions.delete('nested.field');
        expect(compileFilter({ 'nested.field': null }, compiler)).toEqual(['exact:field']);
    });

    it('passes dotted remainders to a registered namespace compiler', () => {
        const namespace: FilterCompiler<string> = (filter, _parent, key) => `${key}:${JSON.stringify(filter)}`;
        const compiler = filterDefinitionsToCompiler(new Map([['nested', namespace]]));
        expect(compileFilter({ 'nested.field': 1 }, compiler)).toEqual(['nested:{"field":1}']);
    });

    it('limits wildcard fallback to absent, non-operator, undotted keys', () => {
        const definitions: FilterDefinitions<string> = new Map([
            ['*', wildcard],
            ['known', exact],
            ['unsupported', () => undefined],
        ]);
        const compiler = filterDefinitionsToCompiler(definitions);
        expect(compileFilter({ known: null, missing: null }, compiler)).toEqual(['exact:known', 'wildcard:missing']);
        expect(compiler(null, compiler, 'unsupported')).toBeUndefined();
        expect(compiler(null, compiler, '$unknown')).toBeUndefined();
        expect(() => compiler(null, compiler, 'missing.field')).toThrow('Unknown filter missing.field');
    });

    it('compiles namespace objects through their own logical operator', () => {
        const and: FilterCompiler<string> = (filter, parent) => compileFilter(filter, parent).join(',');
        const nested: FilterDefinitions<string> = new Map([['$and', and], ['field', exact]]);
        const compiler = filterDefinitionsToCompiler(new Map([['nested', nested]]));
        expect(compileFilter({ nested: { field: null } }, compiler)).toEqual(['exact:field']);
    });
});
