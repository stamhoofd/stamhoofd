export interface PdfSignaturePolicy {
    /** Exact value required in the signer certificate's organizationIdentifier (OID 2.5.4.97). */
    signerOrganizationIdentifier: string;

    trustAnchorPem: string;

    /** Base64 SHA-256 over the SubjectPublicKeyInfo of the trust anchor. */
    trustAnchorSpkiHash: string;

    /**
     * Base64 SHA-256 SPKI hashes of the intermediates the validated path has to go through, in any
     * order. The path's intermediates must be exactly this set, so a valid certificate issued under
     * another CA under the same anchor is still rejected.
     */
    intermediateSpkiHashes: readonly string[];

    /** Hard limit on the input, checked before anything is parsed. */
    maximumFileSize: number;
}
