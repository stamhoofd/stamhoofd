import { describe, expect, it } from 'vitest';
import { buildKeycloakRealm, ssoClientId, ssoClientSecret, ssoUserEmail } from './sso-config.js';

describe('buildKeycloakRealm', () => {
    it('creates a realm with the configured client and user', () => {
        const realm = buildKeycloakRealm('https://example.api.stamhoofd/openid/callback') as any;

        expect(realm.realm).toBe('stamhoofd');
        expect(realm.clients[0].clientId).toBe(ssoClientId);
        expect(realm.clients[0].secret).toBe(ssoClientSecret);
        expect(realm.clients[0].redirectUris).toEqual(['https://example.api.stamhoofd/openid/callback']);
        expect(realm.users[0].email).toBe(ssoUserEmail);
        expect(realm.users[0].credentials[0].temporary).toBe(false);
    });
});
