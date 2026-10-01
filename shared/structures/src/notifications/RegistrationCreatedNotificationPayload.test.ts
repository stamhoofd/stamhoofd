import { NamedObject } from '../Event.js';
import { RegistrationCreatedNotificationPayload } from './RegistrationCreatedNotificationPayload.js';

describe('Unit.RegistrationCreatedNotificationPayload', () => {
    test('decodes a boxed payload and ignores payloads in another shape', () => {
        const payload = RegistrationCreatedNotificationPayload.create({
            group: NamedObject.create({ id: 'group-1', name: 'Kapoenen' }),
        });

        // Stored as JSON in the database
        const stored = JSON.parse(JSON.stringify(payload.encodeBoxed()));
        expect(RegistrationCreatedNotificationPayload.decodeBoxed(stored)?.group).toMatchObject({ id: 'group-1', name: 'Kapoenen' });

        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(RegistrationCreatedNotificationPayload.decodeBoxed({})).toBeNull();
        expect(RegistrationCreatedNotificationPayload.decodeBoxed(null)).toBeNull();
    });
});
