import { isSimpleError } from '@common/errors';
import type { SimpleError } from '@common/errors';
import { beforeAll, describe, expect, test } from 'vitest';

import { getSpkiHash } from '../src/Certificates.js';
import { verifyPdfSignature } from '../src/verifyPdfSignature.js';
import type { TestChain } from '../src/testing/SignedPdfBuilder.js';
import { TEST_SIGNER_COMMON_NAME, TEST_SIGNER_NAME, TEST_SIGNER_ORGANIZATION, TEST_SIGNER_ORGANIZATION_IDENTIFIER, createSignedPdf, createTestChain, issueCertificate, toPem } from '../src/testing/SignedPdfBuilder.js';

const SIGNED_AT = new Date('2026-11-02T17:02:46Z');
const NO_AGE_LIMIT = 100 * 365;

describe('verifyPdfSignature', () => {
    let chain: TestChain;

    // Generating RSA keys is the slow part, so the whole suite shares one chain.
    beforeAll(async () => {
        chain = await createTestChain();
    });

    async function expectFailure(bytes: Uint8Array, code: string, policy = chain.policy, maxAgeInDays = NO_AGE_LIMIT) {
        const thrown = await verifyPdfSignature(bytes, policy, maxAgeInDays).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe(code);
        // Every rejection has something to show the member, naming the policy's signer.
        expect((thrown as SimpleError).human).toBeTruthy();
        expect((thrown as SimpleError).human).toContain(TEST_SIGNER_NAME);
        expect((thrown as SimpleError).human).not.toContain('{');
    }

    async function expectFailureWithMessage(bytes: Uint8Array, code: string, message: string) {
        const thrown = await verifyPdfSignature(bytes, chain.policy, NO_AGE_LIMIT).then(() => null, (error: unknown) => error);

        expect(isSimpleError(thrown)).toBe(true);
        expect((thrown as SimpleError).code).toBe(code);
        // This code is shared with a container that does not parse at all, so the message is the only
        // thing that says which of the two happened.
        expect((thrown as SimpleError).message).toBe(message);
    }

    test('accepts a document signed by the pinned signer, and answers with the path it validated', async () => {
        const bytes = await createSignedPdf({ chain, signedAt: SIGNED_AT });

        const { certificatePath } = await verifyPdfSignature(bytes, chain.policy, NO_AGE_LIMIT);

        // What a caller that looks certificates up afterwards has to run over, so it is part of the
        // contract rather than a detail: the signer, then its issuer, up to the pinned anchor. By key
        // rather than by instance, since the anchor is the one parsed out of the policy.
        expect(await Promise.all(certificatePath.map(certificate => getSpkiHash(certificate)))).toEqual([
            await getSpkiHash(chain.signer.certificate),
            await getSpkiHash(chain.intermediate.certificate),
            await getSpkiHash(chain.anchor.certificate),
        ]);
    });

    test('answers with the signing time the signature carries', async () => {
        // The caller gets the date the signer put its name to, not one read off the pdf, so it is as
        // trustworthy as the rest of what this establishes.
        const bytes = await createSignedPdf({ chain, signedAt: SIGNED_AT });

        const { signedAt } = await verifyPdfSignature(bytes, chain.policy, NO_AGE_LIMIT);

        expect(signedAt).toEqual(SIGNED_AT);
    });

    test('rejects a document changed after signing', async () => {
        const bytes = await createSignedPdf({ chain });
        // One byte inside the signed range, outside the signature itself: the page size.
        const index = new TextDecoder().decode(bytes).indexOf('/MediaBox [0 0 595 842]') + '/MediaBox [0 0 '.length;
        const changed = Uint8Array.from(bytes);
        changed[index] = '6'.charCodeAt(0);

        await expectFailure(changed, 'invalid_signature');
    });

    test('rejects a signature container that carries attached content', async () => {
        // A forger needs no key for this: take any genuine document, move the bytes its signature was
        // made over into its own container, and the signature stays valid over them. pkijs verifies
        // such a container against its own attached bytes and ignores the detached ones it is handed,
        // which would leave the byte range above constraining nothing — so the container is turned
        // down for its shape, before any of that can happen.
        await expectFailure(await createSignedPdf({ chain, attachSignedContent: true }), 'signature_not_detached');
    });

    test('rejects a document changed after the signature, in the range that follows it', async () => {
        // The second signed range is the tail of the file, after the signature itself. Only the first
        // one is covered above, and the two are concatenated by hand, so the tail is worth its own
        // case. Same length, so the byte range still reaches the end of the file.
        const bytes = await createSignedPdf({ chain });
        const index = new TextDecoder().decode(bytes).lastIndexOf('/Size 6');
        const changed = Uint8Array.from(bytes);
        changed[index + '/Size '.length] = '7'.charCodeAt(0);

        await expectFailure(changed, 'invalid_signature');
    });

    test('rejects a container that names two signers', async () => {
        await expectFailure(await createSignedPdf({ chain, twoSigners: true }), 'multiple_signers');
    });

    test('rejects a container that covers something other than detached data', async () => {
        // A timestamp token's content type. pkijs verifies such a container against the token it
        // carries, so the shape is turned down before it reaches that.
        const bytes = await createSignedPdf({ chain, eContentType: '1.2.840.113549.1.9.16.1.4' });

        await expectFailure(bytes, 'signature_not_detached');
    });

    test('rejects a signature whose signer certificate is not embedded', async () => {
        const bytes = await createSignedPdf({
            chain,
            embedCertificates: [chain.intermediate.certificate, chain.anchor.certificate],
        });

        await expectFailureWithMessage(bytes, 'malformed_signature_container', 'The signer certificate is not embedded in the signature.');
    });

    test('rejects a signer named by subject key identifier', async () => {
        // Legal CMS and supported by pkijs, but not by the lookup here, so it has to be refused
        // rather than silently matched against the wrong certificate.
        const bytes = await createSignedPdf({ chain, useSubjectKeyIdentifier: true });

        await expectFailureWithMessage(bytes, 'malformed_signature_container', 'The signer certificate is not embedded in the signature.');
    });

    test('rejects a validly signed document from another signer', async () => {
        const other = await issueCertificate({
            subject: [['2.5.4.3', 'Someone Else'], ['2.5.4.10', 'Someone Else bv'], ['2.5.4.97', 'VATBE-0999999999']],
            issuer: chain.intermediate,
        });

        // A real signature, a chain that validates to the anchor, but not the pinned signer.
        await expectFailure(await createSignedPdf({ chain, signWith: other }), 'unexpected_signer');
    });

    test('rejects a certificate authority as the signer', async () => {
        // Same organization identifier, same issuer, a chain that validates — but a certificate that
        // says it signs certificates. The validated path ending at an end entity is not something the
        // chain validation establishes, so it is asked here.
        const authority = await issueCertificate({
            subject: [
                ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
                ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
                ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
            ],
            issuer: chain.intermediate,
            isCertificateAuthority: true,
        });

        const bytes = await createSignedPdf({
            chain,
            signWith: authority,
            embedCertificates: [authority.certificate, chain.intermediate.certificate, chain.anchor.certificate],
        });

        await expectFailure(bytes, 'signer_is_certificate_authority');
    });

    test('rejects a chain that does not validate to the pinned anchor', async () => {
        const foreignAnchor = await issueCertificate({ subject: [['2.5.4.3', 'Foreign Root']], isCertificateAuthority: true });
        const foreignSigner = await issueCertificate({
            subject: [
                ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
                ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
                ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
            ],
            issuer: foreignAnchor,
        });

        // The signer embeds its own root, which is exactly what a forger would do.
        const bytes = await createSignedPdf({
            chain,
            signWith: foreignSigner,
            embedCertificates: [foreignSigner.certificate, foreignAnchor.certificate],
        });

        await expectFailure(bytes, 'untrusted_certificate_chain');
    });

    test('rejects a chain through an intermediate that is not pinned', async () => {
        const otherIntermediate = await issueCertificate({
            subject: [['2.5.4.3', 'Rotated AATL CA'], ['2.5.4.10', 'Test nv-sa']],
            issuer: chain.anchor,
            isCertificateAuthority: true,
        });

        const rotatedSigner = await issueCertificate({
            subject: [
                ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
                ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
                ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
            ],
            issuer: otherIntermediate,
        });

        const bytes = await createSignedPdf({
            chain,
            signWith: rotatedSigner,
            embedCertificates: [rotatedSigner.certificate, otherIntermediate.certificate, chain.anchor.certificate],
        });

        await expectFailure(bytes, 'unexpected_certificate_chain');
    });

    test('rejects a path that runs through one pinned intermediate twice', async () => {
        // Two intermediates on one key pair, which is what a cross signed certificate authority looks
        // like: the path then holds the same public key twice. Both occurrences are in the pinned set,
        // so a membership test passes a path that is not the pinned set.
        const anchor = await issueCertificate({ subject: [['2.5.4.3', 'Shared Key Root']], isCertificateAuthority: true });
        const first = await issueCertificate({ subject: [['2.5.4.3', 'Shared Key CA 1']], issuer: anchor, isCertificateAuthority: true });
        const second = await issueCertificate({ subject: [['2.5.4.3', 'Shared Key CA 2']], issuer: first, isCertificateAuthority: true, reuseKeysOf: first });
        const signer = await issueCertificate({
            subject: [
                ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
                ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
                ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
            ],
            issuer: second,
        });

        const bytes = await createSignedPdf({
            chain,
            signWith: signer,
            embedCertificates: [signer.certificate, second.certificate, first.certificate, anchor.certificate],
        });

        const policy = {
            ...chain.policy,
            trustAnchorPem: toPem(anchor.certificate),
            trustAnchorSpkiHash: await getSpkiHash(anchor.certificate),
            // The shared key, and one more the path never reaches.
            intermediateSpkiHashes: [await getSpkiHash(first.certificate), await getSpkiHash(chain.intermediate.certificate)],
        };

        await expectFailure(bytes, 'unexpected_certificate_chain', policy);
    });

    test('rejects a signature made outside the signer certificate validity', async () => {
        const expiring = await createTestChain({
            signerNotBefore: new Date('2024-01-01T00:00:00Z'),
            signerNotAfter: new Date('2025-01-01T00:00:00Z'),
        });

        const bytes = await createSignedPdf({ chain: expiring, signedAt: SIGNED_AT });

        await expectFailure(bytes, 'certificate_expired_at_signing_time', expiring.policy);
    });

    test('rejects a signed content type that is not data', async () => {
        // The signature is genuine and the container still says it covers detached data; only the
        // content type the signer put its name to disagrees. CAdES requires the two to match, and
        // pkijs checks that the attribute is there without ever reading it.
        const bytes = await createSignedPdf({ chain, contentTypeAttributeOid: '1.2.840.113549.1.9.16.1.4' });

        await expectFailure(bytes, 'unexpected_signed_content_type');
    });

    test('accepts a signing-certificate-v2 attribute that names the signer', async () => {
        const bytes = await createSignedPdf({ chain, signedAt: SIGNED_AT, signingCertificate: chain.signer.certificate });

        await expect(verifyPdfSignature(bytes, chain.policy, NO_AGE_LIMIT)).resolves.toHaveProperty('certificatePath.length', 3);
    });

    test('rejects a signing-certificate-v2 attribute that names another certificate', async () => {
        // CAdES' binding between the signature and the certificate it belongs to. A signature whose
        // own attributes point at a different certificate than the one it was verified with is not a
        // signature by that certificate.
        const bytes = await createSignedPdf({ chain, signedAt: SIGNED_AT, signingCertificate: chain.anchor.certificate });

        await expectFailure(bytes, 'unexpected_signing_certificate');
    });

    test('rejects a signature without a signing time', async () => {
        await expectFailure(await createSignedPdf({ chain, withoutSigningTime: true }), 'missing_signing_time');
    });

    test('rejects a signature carrying two signing times', async () => {
        // One inside the age the caller allows and one far outside it. Reading whichever comes first
        // would make the order of the attributes decide whether the document is too old.
        const bytes = await createSignedPdf({
            chain,
            signedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            secondSignedAt: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000),
        });

        await expectFailure(bytes, 'missing_signing_time', chain.policy, 90);
    });

    test('rejects a signer certificate naming its organization identifier twice', async () => {
        // One value the policy accepts and one it does not. The subject has no single answer, so the
        // comparison has nothing to compare and the certificate is refused.
        const ambiguous = await issueCertificate({
            subject: [
                ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
                ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
                ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
                ['2.5.4.97', 'VATBE-0999999999'],
            ],
            issuer: chain.intermediate,
        });

        const bytes = await createSignedPdf({
            chain,
            signWith: ambiguous,
            embedCertificates: [ambiguous.certificate, chain.intermediate.certificate, chain.anchor.certificate],
        });

        await expectFailure(bytes, 'unexpected_signer');
    });

    test('rejects a digest algorithm that is not SHA-256', async () => {
        // SHA-512 first, to show this is an exact pin and not a filter on weak hashes, then SHA-1.
        await expectFailure(await createSignedPdf({ chain, digestAlgorithm: '2.16.840.1.101.3.4.2.3' }), 'unsupported_digest_algorithm');
        await expectFailure(await createSignedPdf({ chain, digestAlgorithm: '1.3.14.3.2.26' }), 'unsupported_digest_algorithm');
    });

    test('rejects a signature algorithm that is not sha256WithRSAEncryption', async () => {
        // sha1WithRSAEncryption, named by a container whose digest algorithm is still SHA-256 — so
        // the digest check passes it. The OID encodes to the same number of bytes, which is what
        // makes this cheap to do to a document. Rejected on the algorithm, before the signature is
        // ever checked.
        const bytes = await createSignedPdf({ chain, signatureAlgorithm: '1.2.840.113549.1.1.5' });

        await expectFailure(bytes, 'unsupported_signature_algorithm');
    });

    test('rejects a signature dated in the future', async () => {
        const bytes = await createSignedPdf({ chain, signedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) });

        await expectFailure(bytes, 'signed_in_the_future');
    });

    test('accepts a signing time a little ahead of us, which is clock drift', async () => {
        // Rounded to the second, since that is all a UTCTime signing time holds.
        const signedAt = new Date(Math.floor((Date.now() + 60 * 1000) / 1000) * 1000);

        await expect(verifyPdfSignature(await createSignedPdf({ chain, signedAt }), chain.policy, NO_AGE_LIMIT)).resolves.toHaveProperty('signedAt', signedAt);
    });

    test('rejects a signature older than the caller allows', async () => {
        const bytes = await createSignedPdf({ chain, signedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) });

        await expectFailure(bytes, 'signature_too_old', chain.policy, 90);
    });

    test('accepts a signature within the age the caller allows', async () => {
        const bytes = await createSignedPdf({ chain, signedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) });

        await expect(verifyPdfSignature(bytes, chain.policy, 90)).resolves.toHaveProperty('certificatePath.length', 3);

        // The age is the caller's to set, so the same document fails a stricter requirement.
        await expectFailure(bytes, 'signature_too_old', chain.policy, 7);
    });

    test('rejects a trust anchor that does not match its pin', async () => {
        const bytes = await createSignedPdf({ chain });
        const other = await issueCertificate({ subject: [['2.5.4.3', 'Swapped Root']], isCertificateAuthority: true });

        // Swapping the bundled PEM without touching the pin must not move the trust anchor.
        await expectFailure(bytes, 'untrusted_certificate_chain', { ...chain.policy, trustAnchorPem: toPem(other.certificate) });
    });

    test('rejects a file larger than the policy allows', async () => {
        const bytes = await createSignedPdf({ chain });

        await expectFailure(bytes, 'file_too_large', { ...chain.policy, maximumFileSize: 128 });
    });

    test('rejects /Contents that is not CMS SignedData', async () => {
        const bytes = await createSignedPdf({ chain });
        const text = new TextDecoder().decode(bytes);
        const start = text.indexOf('/Contents <') + '/Contents <'.length;
        const broken = Uint8Array.from(bytes);
        // Keep the length, so the byte range still covers the document, but break the container.
        broken.set(new TextEncoder().encode('ff'.repeat(8)), start);

        await expectFailure(broken, 'malformed_signature_container');
    });

    /**
     * The CMS certificate set sits inside `/Contents`, which the byte range leaves out, so it is the
     * one part of a genuine document that can be edited without breaking the signature. Nothing here
     * may therefore be believed because it is present and looks right: what counts is the path that
     * validated to the pinned anchor.
     */
    describe('a decoy certificate in the signature container', () => {
        async function expectGenuinePath(bytes: Uint8Array) {
            const { certificatePath } = await verifyPdfSignature(bytes, chain.policy, NO_AGE_LIMIT);

            expect(await Promise.all(certificatePath.map(certificate => getSpkiHash(certificate)))).toEqual([
                await getSpkiHash(chain.signer.certificate),
                await getSpkiHash(chain.intermediate.certificate),
                await getSpkiHash(chain.anchor.certificate),
            ]);
        }

        test('cannot displace the real intermediate by carrying its subject', async () => {
            // The real intermediate's name on a key of its own, ahead of the real one in the set, so
            // picking an issuer by name rather than by signature would pick this.
            const decoy = await issueCertificate({
                subject: [['2.5.4.3', 'Test AATL CA'], ['2.5.4.10', 'Test nv-sa']],
                isCertificateAuthority: true,
            });

            await expectGenuinePath(await createSignedPdf({
                chain,
                embedCertificates: [chain.signer.certificate, decoy.certificate, chain.intermediate.certificate, chain.anchor.certificate],
            }));
        });

        test('cannot displace the real intermediate by being a self-signed authority of its own', async () => {
            // Self-issued, so it is its own anchor. A walk that stops at the first self-signed
            // certificate it reaches would end here instead of at the pinned anchor.
            const decoy = await issueCertificate({
                subject: [['2.5.4.3', 'Test Rogue Root'], ['2.5.4.10', 'Test nv-sa']],
                isCertificateAuthority: true,
            });

            await expectGenuinePath(await createSignedPdf({
                chain,
                embedCertificates: [chain.signer.certificate, decoy.certificate, chain.intermediate.certificate, chain.anchor.certificate],
            }));
        });

        test('cannot displace the signer by carrying the signer public key under another issuer', async () => {
            // The one decoy the signature itself cannot tell apart from the real signer: the same
            // public key, so the signature verifies against it too. What separates them is the issuer
            // and serial the container names, and the signing-certificate attribute.
            const rogueRoot = await issueCertificate({
                subject: [['2.5.4.3', 'Test Rogue Root'], ['2.5.4.10', 'Test nv-sa']],
                isCertificateAuthority: true,
            });
            const decoy = await issueCertificate({
                subject: [
                    ['2.5.4.3', TEST_SIGNER_COMMON_NAME],
                    ['2.5.4.10', TEST_SIGNER_ORGANIZATION],
                    ['2.5.4.97', TEST_SIGNER_ORGANIZATION_IDENTIFIER],
                ],
                issuer: rogueRoot,
                reuseKeysOf: chain.signer,
            });

            await expectGenuinePath(await createSignedPdf({
                chain,
                embedCertificates: [decoy.certificate, rogueRoot.certificate, chain.signer.certificate, chain.intermediate.certificate, chain.anchor.certificate],
            }));
        });
    });
});
