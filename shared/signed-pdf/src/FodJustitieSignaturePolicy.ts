import type { PdfSignaturePolicy } from './PdfSignaturePolicy.js';

/**
 * GlobalSign Document Signing Root R45, the trust anchor of the certificate FOD Justitie signs an
 * extract with. Byte identical to https://secure.globalsign.com/cacert/docsignrootr45.crt
 * (SHA-256 of the certificate: 38:BE:6C:7E:EB:45:47:D8:2B:92:87:F2:43:AF:32:A9:DE:EB:5D:C5:C9:A8:7A:00:56:F9:38:D9:1B:45:6A:5A).
 */
export const GLOBALSIGN_DOCUMENT_SIGNING_ROOT_R45_PEM
    = ''
        + '-----BEGIN CERTIFICATE-----\n'
        + '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\n'
        + 'Rn7JhIJYRobXTF+4bZk=\n'
        + '-----END CERTIFICATE-----\n';

export const FOD_JUSTITIE_SIGNATURE_POLICY: PdfSignaturePolicy = {
    /** The VAT number of FOD Justitie. */
    signerOrganizationIdentifier: 'VATBE-0308357753',

    trustAnchorPem: GLOBALSIGN_DOCUMENT_SIGNING_ROOT_R45_PEM,

    /** GlobalSign Document Signing Root R45 */
    trustAnchorSpkiHash: 'btDb2Vni7L6DI5gWCCb2Au5EHhqW8BVXm/OmcpKmDT4=',

    intermediateSpkiHashes: [
        /** GlobalSign R45 AATL Root CA 2020, cross signed by the anchor */
        'YYwt/weuIJ/XnAZWL4qYeoq6hL+A1z5bCNWtoVP3Ook=',
        /** GlobalSign GCC R45 AATL CA 2020, the issuer of the FOD Justitie certificate */
        '3sf39Oyj72N3CQ7MAwRYNOEpzRmJb/XLdDdG3ZGaPXM=',
    ],

    maximumFileSize: 1 * 1024 * 1024, // 1 MB
};
