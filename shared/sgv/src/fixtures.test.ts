import {
    createSGVLidFixture,
    defaultSGVFuncties,
    defaultSGVGroepNumber,
} from './fixtures.js';

describe('@stamhoofd/sgv fixtures', () => {
    it('creates members that can be listed with SGV default functions', () => {
        const member = createSGVLidFixture();

        expect(defaultSGVFuncties.map(f => f.code)).toContain('JIN');
        expect(member.functies[0].groep).toBe(defaultSGVGroepNumber);
        expect(member.vgagegevens.voornaam).toBe('Existing');
    });
});
