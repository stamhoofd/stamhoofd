import { describe, expect, test } from 'vitest';

import { getSpkiHash, getSubjectAttribute, parsePemCertificate } from '../src/Certificates.js';
import { FOD_JUSTITIE_SIGNATURE_POLICY, GLOBALSIGN_DOCUMENT_SIGNING_ROOT_R45_PEM } from '../src/FodJustitieSignaturePolicy.js';

/**
 * Only what a reviewer reading the diff could not catch. Asserting that a pin equals the literal it
 * is set to is bookkeeping, not a test: it fails only when someone edits the constant, and they edit
 * the copy here in the same breath.
 */
describe('FOD_JUSTITIE_SIGNATURE_POLICY', () => {
    test('the bundled trust anchor is GlobalSign Document Signing Root R45 and matches its pin', async () => {
        const anchor = parsePemCertificate(GLOBALSIGN_DOCUMENT_SIGNING_ROOT_R45_PEM);

        // The PEM and the hash are two independent copies of one fact, derived differently, so either
        // one edited alone has to fail here. That is the whole point of pinning the hash next to the
        // certificate it belongs to.
        expect(await getSpkiHash(anchor)).toBe(FOD_JUSTITIE_SIGNATURE_POLICY.trustAnchorSpkiHash);

        // The hash covers the public key only, so the name it belongs to is worth asserting beside it.
        expect(getSubjectAttribute(anchor, '2.5.4.3')).toBe('GlobalSign Document Signing Root R45');
        expect(anchor.issuer.isEqual(anchor.subject)).toBe(true);
    });
});
