// Imports GroupSettings before Group on purpose. GroupSettings may only reference Group as a
// type: a value import closes an initialisation cycle, and whichever module is evaluated first
// then leaves the other's decoder undefined. Entering through the barrel happens to be safe,
// so only a deep import in this order catches a regression.
import { GroupSettings } from './GroupSettings.js';
import { Group } from './Group.js';

describe('Group / GroupSettings module initialisation', () => {
    test('Group keeps its settings decoder when GroupSettings is evaluated first', () => {
        expect(GroupSettings).toBeDefined();

        const settingsField = (Group as unknown as { fields: { property: string; decoder: unknown }[] })
            .fields.find(f => f.property === 'settings');

        expect(settingsField?.decoder).toBe(GroupSettings);
        expect(() => Group.patch({})).not.toThrow();
    });
});
