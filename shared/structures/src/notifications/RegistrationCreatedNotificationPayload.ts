import type { Decoder } from '@simonbackx/simple-encoding';
import { AutoEncoder, field, ObjectData, VersionBox, VersionBoxDecoder } from '@simonbackx/simple-encoding';
import { NamedObject } from '../Event.js';
import { Version } from '../Version.js';

/**
 * Stored in a VersionBox because notifications are kept in the database
 */
export class RegistrationCreatedNotificationPayload extends AutoEncoder {
    @field({ decoder: NamedObject })
    group: NamedObject;

    encodeBoxed(): unknown {
        return new VersionBox(this).encode({ version: Version });
    }

    static decodeBoxed(payload: unknown): RegistrationCreatedNotificationPayload | null {
        try {
            return new ObjectData(payload, { version: 0 }).decode(new VersionBoxDecoder(RegistrationCreatedNotificationPayload as Decoder<RegistrationCreatedNotificationPayload>)).data;
        } catch (e) {
            console.error('Failed to decode notification payload', e);
            return null;
        }
    }
}
