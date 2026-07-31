import { isoCBOR } from '@simplewebauthn/server/helpers';
import { WebauthnCredential } from '@stamhoofd/models';
import { WebauthnAssertionResponseData, WebauthnAuthenticationCredential } from '@stamhoofd/structures';
import { TestUtils } from '@stamhoofd/test-utils';
import crypto from 'crypto';

import { WebauthnHelper } from './WebauthnHelper.js';

// The fingerprint of one of the Android release certificates, in the notation of
// assetlinks.json, and the origin Android derives from it.
const FINGERPRINT = 'A0:7B:07:40:BD:36:D6:07:29:C5:E4:5C:06:68:C6:CE:4B:B0:F6:F8:CD:B3:51:FC:1E:CF:06:78:AF:7C:2C:75';
const FINGERPRINT_ORIGIN = 'android:apk-key-hash:oHsHQL021gcpxeRcBmjGzkuw9vjNs1H8Hs8GeK98LHU';

/**
 * A passkey as an authenticator holds it: an ES256 key pair, plus the COSE encoding of the
 * public key that we store on the credential.
 */
function createKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' });

    const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, new Uint8Array(Buffer.from(jwk.x!, 'base64url'))],
        [-3, new Uint8Array(Buffer.from(jwk.y!, 'base64url'))],
    ]));

    return { privateKey, cosePublicKey: Buffer.from(cose).toString('base64url') };
}

/**
 * Build and sign the assertion an authenticator returns when it releases a passkey, so the
 * whole verification path runs (origin, RP ID hash, challenge and signature).
 */
function signAssertion({ privateKey, rpId, origin, challenge }: { privateKey: crypto.KeyObject; rpId: string; origin: string; challenge: string }): WebauthnAuthenticationCredential {
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));

    // rpIdHash (32) + flags (user present + user verified) + signature counter
    const authenticatorData = Buffer.concat([
        crypto.createHash('sha256').update(rpId).digest(),
        Buffer.from([0x05]),
        Buffer.from([0x00, 0x00, 0x00, 0x01]),
    ]);

    const signature = crypto.sign('sha256', Buffer.concat([
        authenticatorData,
        crypto.createHash('sha256').update(clientDataJSON).digest(),
    ]), privateKey);

    return WebauthnAuthenticationCredential.create({
        id: 'test-credential',
        rawId: 'test-credential',
        response: WebauthnAssertionResponseData.create({
            clientDataJSON: clientDataJSON.toString('base64url'),
            authenticatorData: authenticatorData.toString('base64url'),
            signature: signature.toString('base64url'),
        }),
    });
}

function createStoredCredential(cosePublicKey: string): WebauthnCredential {
    const credential = new WebauthnCredential();
    credential.userId = 'test-user';
    credential.credentialId = 'test-credential';
    credential.publicKey = cosePublicKey;
    credential.counter = 0;
    credential.rpId = WebauthnHelper.getRpID();
    return credential;
}

describe('WebauthnHelper', () => {
    describe('expected origins', () => {
        test('the web apps and the iOS app are accepted', () => {
            const rpId = WebauthnHelper.getRpID();
            const origins = WebauthnHelper.getExpectedOrigins(rpId);

            expect(origins).toContain('https://' + rpId);
            expect(origins).toContain('capacitor://' + rpId);
        });

        test('a configured Android certificate is accepted as an origin', () => {
            TestUtils.setEnvironment('ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS', [FINGERPRINT]);

            expect(WebauthnHelper.getExpectedOrigins(WebauthnHelper.getRpID())).toContain(FINGERPRINT_ORIGIN);
        });

        test('a fingerprint without separators is accepted too', () => {
            TestUtils.setEnvironment('ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS', [FINGERPRINT.replace(/:/g, '').toLowerCase()]);

            expect(WebauthnHelper.getExpectedOrigins(WebauthnHelper.getRpID())).toContain(FINGERPRINT_ORIGIN);
        });

        test('no Android origins are accepted when none are configured', () => {
            expect(STAMHOOFD.ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS).toBeUndefined();

            expect(WebauthnHelper.getExpectedOrigins(WebauthnHelper.getRpID()).filter(o => o.startsWith('android:'))).toHaveLength(0);
        });

        test('a fingerprint that is not a SHA-256 hash is rejected', () => {
            TestUtils.setEnvironment('ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS', ['A0:7B:07']);

            expect(() => WebauthnHelper.getExpectedOrigins(WebauthnHelper.getRpID())).toThrow('Invalid SHA-256 certificate fingerprint');
        });
    });

    describe('verifying an assertion', () => {
        test('a passkey used inside the Android app is accepted', async () => {
            TestUtils.setEnvironment('ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS', [FINGERPRINT]);

            const { privateKey, cosePublicKey } = createKeyPair();
            const stored = createStoredCredential(cosePublicKey);
            const challenge = crypto.randomBytes(32).toString('base64url');

            const assertion = signAssertion({ privateKey, rpId: stored.rpId!, origin: FINGERPRINT_ORIGIN, challenge });

            expect(await WebauthnHelper.verifyAuthentication(assertion, challenge, stored)).toBe(1);
        });

        test('a passkey used inside an app we did not sign is refused', async () => {
            TestUtils.setEnvironment('ANDROID_PASSKEY_SHA256_CERT_FINGERPRINTS', [FINGERPRINT]);

            const { privateKey, cosePublicKey } = createKeyPair();
            const stored = createStoredCredential(cosePublicKey);
            const challenge = crypto.randomBytes(32).toString('base64url');

            const otherApp = 'android:apk-key-hash:' + crypto.randomBytes(32).toString('base64url');
            const assertion = signAssertion({ privateKey, rpId: stored.rpId!, origin: otherApp, challenge });

            expect(await WebauthnHelper.verifyAuthentication(assertion, challenge, stored)).toBeNull();
        });

        test('a passkey used in the browser stays accepted', async () => {
            const { privateKey, cosePublicKey } = createKeyPair();
            const stored = createStoredCredential(cosePublicKey);
            const challenge = crypto.randomBytes(32).toString('base64url');

            const assertion = signAssertion({ privateKey, rpId: stored.rpId!, origin: 'https://' + stored.rpId, challenge });

            expect(await WebauthnHelper.verifyAuthentication(assertion, challenge, stored)).toBe(1);
        });
    });
});
