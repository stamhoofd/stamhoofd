import { ObjectData } from '@simonbackx/simple-encoding';
import { describe, expect, it } from 'vitest';

import { CustomerFieldRequirement } from './CustomerFieldRequirement.js';
import { CustomerSettings } from './CustomerSettings.js';
import { WebshopMetaData } from './WebshopMetaData.js';

const { Required, Optional, Disabled } = CustomerFieldRequirement;

/**
 * customerSettings replaces the phoneEnabled / birthDayEnabled / addressEnabled / genderEnabled flags in 419.
 */
const oldVersion = 418;
const newVersion = 419;

function encode(meta: WebshopMetaData, version: number) {
    return meta.encode({ version }) as Record<string, any>;
}

function decode(data: Record<string, any>, version: number) {
    return WebshopMetaData.decode(new ObjectData(data, { version }));
}

function encodePatch(patch: ReturnType<typeof WebshopMetaData.patch>, version: number) {
    return patch.encode({ version }) as Record<string, any>;
}

function decodePatch(data: Record<string, any>, version: number) {
    return WebshopMetaData.patchType().decode(new ObjectData(data, { version }));
}

describe('WebshopMetaData.customerSettings 418 <-> 419', () => {
    describe('upgrade: 418 -> 419', () => {
        it('builds the settings from the flags', () => {
            const meta = decode({ phoneEnabled: false, birthDayEnabled: true, addressEnabled: false, genderEnabled: true }, oldVersion);

            expect(meta.customerSettings.phone).toBe(Disabled);
            expect(meta.customerSettings.birthDay).toBe(Required);
            expect(meta.customerSettings.address).toBe(Disabled);
            expect(meta.customerSettings.gender).toBe(Required);
            // Always needed for the order confirmation
            expect(meta.customerSettings.email).toBe(Required);
        });

        it('uses the flag defaults when they are missing', () => {
            const meta = decode({}, oldVersion);

            expect(meta.customerSettings.phone).toBe(Required);
            expect(meta.customerSettings.birthDay).toBe(Disabled);
            expect(meta.customerSettings.address).toBe(Disabled);
            expect(meta.customerSettings.gender).toBe(Disabled);
        });

        it('does not run on data that already has the settings', () => {
            const meta = decode({
                phoneEnabled: true,
                customerSettings: { email: Required, phone: Disabled, birthDay: Optional, gender: Disabled, address: Disabled },
            }, newVersion);

            expect(meta.customerSettings.phone).toBe(Disabled);
            expect(meta.customerSettings.birthDay).toBe(Optional);
        });
    });

    describe('downgrade: 419 -> 418', () => {
        it('derives the flags from the settings and drops the settings', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Disabled, birthDay: Optional, address: Required, gender: Disabled }),
                // Stale values: an older client must not see these
                legacyPhoneEnabled: true,
                legacyBirthDayEnabled: false,
                legacyAddressEnabled: false,
                legacyGenderEnabled: true,
            });

            const encoded = encode(meta, oldVersion);

            expect(encoded.phoneEnabled).toBe(false);
            // Optional is still asked, so the flag stays on
            expect(encoded.birthDayEnabled).toBe(true);
            expect(encoded.addressEnabled).toBe(true);
            expect(encoded.genderEnabled).toBe(false);
            expect(encoded.customerSettings).toBeUndefined();
        });

        it('keeps the settings on 419', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Optional, birthDay: Disabled }),
            });

            const encoded = encode(meta, newVersion);

            expect(encoded.customerSettings).toMatchObject({ phone: Optional, birthDay: Disabled });
        });

        it('survives a round trip through a 418 client', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Required, birthDay: Disabled, address: Required, gender: Disabled }),
            });

            const roundTripped = decode(encode(meta, oldVersion), oldVersion);

            expect(roundTripped.customerSettings.phone).toBe(Required);
            expect(roundTripped.customerSettings.birthDay).toBe(Disabled);
            expect(roundTripped.customerSettings.address).toBe(Required);
            expect(roundTripped.customerSettings.gender).toBe(Disabled);
        });

        it('keeps an Optional field intact on a 419 round trip', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Optional, birthDay: Disabled }),
            });

            const roundTripped = decode(encode(meta, newVersion), newVersion);

            expect(roundTripped.customerSettings.phone).toBe(Optional);
            expect(roundTripped.customerSettings.birthDay).toBe(Disabled);
        });
    });

    describe('upgradePatch: 418 -> 419', () => {
        it('turns a flag patch into a settings patch', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Required, birthDay: Required, address: Disabled, gender: Disabled }),
            });

            const patched = meta.patch(decodePatch({ phoneEnabled: false, addressEnabled: true }, oldVersion));

            expect(patched.customerSettings.phone).toBe(Disabled);
            expect(patched.customerSettings.address).toBe(Required);
            // Not part of the patch
            expect(patched.customerSettings.birthDay).toBe(Required);
            expect(patched.customerSettings.gender).toBe(Disabled);
        });

        it('leaves the settings alone for a patch without flags', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Optional, birthDay: Required }),
            });

            const patched = meta.patch(decodePatch({ name: 'Nieuwe naam' }, oldVersion));

            expect(patched.name).toBe('Nieuwe naam');
            expect(patched.customerSettings.phone).toBe(Optional);
            expect(patched.customerSettings.birthDay).toBe(Required);
        });
    });

    describe('downgradePatch: 419 -> 418', () => {
        it('encodes a settings patch as flags', () => {
            const patch = WebshopMetaData.patch({
                customerSettings: CustomerSettings.patch({ phone: Disabled, gender: Optional }),
            });

            const encoded = encodePatch(patch, oldVersion);

            expect(encoded.phoneEnabled).toBe(false);
            expect(encoded.genderEnabled).toBe(true);
            // Not part of the patch
            expect(encoded.birthDayEnabled).toBeUndefined();
            expect(encoded.addressEnabled).toBeUndefined();
            expect(encoded.customerSettings).toBeUndefined();
        });

        it('keeps the settings patch on 419', () => {
            const patch = WebshopMetaData.patch({
                customerSettings: CustomerSettings.patch({ phone: Disabled }),
            });

            const encoded = encodePatch(patch, newVersion);

            expect(encoded.customerSettings).toMatchObject({ phone: Disabled });
            expect(encoded.phoneEnabled).toBeUndefined();
        });

        it('encodes nothing for a patch that does not touch the settings', () => {
            const encoded = encodePatch(WebshopMetaData.patch({ name: 'Nieuwe naam' }), oldVersion);

            expect(encoded.name).toBe('Nieuwe naam');
            expect(encoded.phoneEnabled).toBeUndefined();
            expect(encoded.birthDayEnabled).toBeUndefined();
            expect(encoded.addressEnabled).toBeUndefined();
            expect(encoded.genderEnabled).toBeUndefined();
        });

        it('survives a patch round trip through a 418 client', () => {
            const meta = WebshopMetaData.create({
                customerSettings: CustomerSettings.create({ phone: Required, birthDay: Required }),
            });
            const patch = WebshopMetaData.patch({
                customerSettings: CustomerSettings.patch({ phone: Disabled }),
            });

            const patched = meta.patch(decodePatch(encodePatch(patch, oldVersion), oldVersion));

            expect(patched.customerSettings.phone).toBe(Disabled);
            expect(patched.customerSettings.birthDay).toBe(Required);
        });
    });
});
