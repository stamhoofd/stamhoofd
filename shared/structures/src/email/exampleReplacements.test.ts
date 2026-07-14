import '../circular-dependencies/ExampleReplacementsDependencies.js';
import { ExampleReplacements } from './exampleReplacements.js';

describe('ExampleReplacements', () => {
    const originalT = (globalThis as any).$t;
    const originalGetLanguage = (globalThis as any).$getLanguage;

    afterEach(() => {
        (globalThis as any).$t = originalT;
        (globalThis as any).$getLanguage = originalGetLanguage;
    });

    function setLanguage(language: string) {
        (globalThis as any).$getLanguage = () => language;
        (globalThis as any).$t = (key: string) => `${language}:${key}`;
    }

    it('generates the example values in the active language', () => {
        // Note: firstNameMember is used because it is not overwritten by the injected
        // example order values (which overwrite e.g. firstName with a fixed example)
        setLanguage('nl');
        expect(ExampleReplacements.all.firstNameMember.value).toBe('nl:%13h');

        setLanguage('fr');
        expect(ExampleReplacements.all.firstNameMember.value).toBe('fr:%13h');
    });

    it('caches the generated replacements per language', () => {
        setLanguage('nl');
        const dutch = ExampleReplacements.all;
        expect(ExampleReplacements.all).toBe(dutch);

        setLanguage('fr');
        const french = ExampleReplacements.all;
        expect(french).not.toBe(dutch);

        setLanguage('nl');
        expect(ExampleReplacements.all).toBe(dutch);
    });
});
