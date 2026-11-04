import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import type { RevocationHttpClient } from '../../src/RevocationHttpClient.js';

/**
 * Certificates, OCSP responses and revocation lists built at test time: no network, and nobody's
 * certificate committed here.
 */

const KEY_ALGORITHM = {
    name: 'RSASSA-PKCS1-v1_5',
    hash: 'SHA-256',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
};

const BASIC_CONSTRAINTS_OID = '2.5.29.19';
const AUTHORITY_INFO_ACCESS_OID = '1.3.6.1.5.5.7.1.1';
const CRL_DISTRIBUTION_POINTS_OID = '2.5.29.31';
const OCSP_ACCESS_METHOD_OID = '1.3.6.1.5.5.7.48.1';
const URI_GENERAL_NAME = 6;

export interface TestCertificate {
    certificate: pkijs.Certificate;
    privateKey: CryptoKey;
}

let nextSerialNumber = 1;

export async function issueCertificate(options: {
    commonName: string;
    issuer?: TestCertificate;
    isCertificateAuthority?: boolean;
    ocspUrl?: string;
    crlUrl?: string;
}): Promise<TestCertificate> {
    const crypto = pkijs.getCrypto(true);
    const keys = await crypto.generateKey(KEY_ALGORITHM, true, ['sign', 'verify']);

    const certificate = new pkijs.Certificate();
    certificate.version = 2;
    certificate.serialNumber = new asn1js.Integer({ value: nextSerialNumber++ });
    certificate.subject = distinguishedName(options.commonName);
    certificate.issuer = options.issuer ? options.issuer.certificate.subject : certificate.subject;
    certificate.notBefore.value = new Date('2020-01-01T00:00:00Z');
    certificate.notAfter.value = new Date('2040-01-01T00:00:00Z');
    certificate.extensions = [
        new pkijs.Extension({
            extnID: BASIC_CONSTRAINTS_OID,
            critical: true,
            extnValue: new pkijs.BasicConstraints({ cA: options.isCertificateAuthority ?? false }).toSchema().toBER(false),
        }),
    ];

    if (options.ocspUrl !== undefined) {
        certificate.extensions.push(new pkijs.Extension({
            extnID: AUTHORITY_INFO_ACCESS_OID,
            critical: false,
            extnValue: new pkijs.InfoAccess({
                accessDescriptions: [new pkijs.AccessDescription({
                    accessMethod: OCSP_ACCESS_METHOD_OID,
                    accessLocation: new pkijs.GeneralName({ type: URI_GENERAL_NAME, value: options.ocspUrl }),
                })],
            }).toSchema().toBER(false),
        }));
    }

    if (options.crlUrl !== undefined) {
        certificate.extensions.push(new pkijs.Extension({
            extnID: CRL_DISTRIBUTION_POINTS_OID,
            critical: false,
            extnValue: new pkijs.CRLDistributionPoints({
                distributionPoints: [new pkijs.DistributionPoint({
                    distributionPoint: [new pkijs.GeneralName({ type: URI_GENERAL_NAME, value: options.crlUrl })],
                })],
            }).toSchema().toBER(false),
        }));
    }

    await certificate.subjectPublicKeyInfo.importKey(keys.publicKey, crypto);
    await certificate.sign(options.issuer ? options.issuer.privateKey : keys.privateKey, 'SHA-256', crypto);

    return { certificate, privateKey: keys.privateKey };
}

export type TestOcspStatus = 'good' | 'revoked' | 'unknown';

/** Signed by the issuer and about `certificate`, unless a test says otherwise. */
export async function createOcspResponse(options: {
    certificate: pkijs.Certificate;
    issuer: TestCertificate;
    status: TestOcspStatus;
    /** Sign with this instead of the issuer: a stranger's response must not be believed. */
    signedBy?: TestCertificate;
    /** Answer about this certificate instead: a response about another one says nothing. */
    about?: pkijs.Certificate;
    /** Anything but 0 means the responder refused to answer. */
    responseStatus?: number;
}): Promise<Uint8Array> {
    const crypto = pkijs.getCrypto(true);
    const signer = options.signedBy ?? options.issuer;

    const single = new pkijs.SingleResponse();
    await single.certID.createForCertificate(options.about ?? options.certificate, {
        hashAlgorithm: 'SHA-256',
        issuerCertificate: options.issuer.certificate,
    }, crypto);
    single.certStatus = certStatus(options.status);
    single.thisUpdate = new Date('2026-11-04T00:00:00Z');

    const basic = new pkijs.BasicOCSPResponse();
    basic.tbsResponseData.responderID = signer.certificate.subject;
    basic.tbsResponseData.producedAt = new Date('2026-11-04T00:00:00Z');
    basic.tbsResponseData.responses.push(single);
    basic.certs = [signer.certificate];
    await basic.sign(signer.privateKey, 'SHA-256', crypto);

    const response = new pkijs.OCSPResponse();
    response.responseStatus.valueBlock.valueDec = options.responseStatus ?? 0;
    response.responseBytes = new pkijs.ResponseBytes({
        responseType: pkijs.id_PKIX_OCSP_Basic,
        response: new asn1js.OctetString({ valueHex: basic.toSchema().toBER(false) }),
    });

    return new Uint8Array(response.toSchema().toBER(false));
}

/** Signed by the issuer unless a test says otherwise. */
export async function createCrl(options: {
    issuer: TestCertificate;
    revoked?: pkijs.Certificate[];
    thisUpdate?: Date;
    nextUpdate?: Date | null;
    /** Sign with this instead of the issuer: a list signed by a stranger says nothing. */
    signedBy?: TestCertificate;
}): Promise<Uint8Array> {
    const crypto = pkijs.getCrypto(true);
    const signer = options.signedBy ?? options.issuer;

    const list = new pkijs.CertificateRevocationList();
    list.version = 1;
    list.issuer = options.issuer.certificate.subject;
    list.thisUpdate = new pkijs.Time({ type: 0, value: options.thisUpdate ?? new Date('2026-11-01T00:00:00Z') });

    if (options.nextUpdate !== null) {
        list.nextUpdate = new pkijs.Time({ type: 0, value: options.nextUpdate ?? new Date('2026-12-01T00:00:00Z') });
    }

    list.revokedCertificates = (options.revoked ?? []).map(certificate => new pkijs.RevokedCertificate({
        userCertificate: certificate.serialNumber,
        revocationDate: new pkijs.Time({ type: 0, value: new Date('2026-10-01T00:00:00Z') }),
    }));

    await list.sign(signer.privateKey, 'SHA-256', crypto);

    return new Uint8Array(list.toSchema(true).toBER(false));
}

/** Records what was asked: the order of OCSP before a list is part of the behaviour. */
export class StubRevocationHttpClient implements RevocationHttpClient {
    readonly calls: string[] = [];
    private readonly responses = new Map<string, Uint8Array | Error>();

    answer(url: string, response: Uint8Array | Error): this {
        this.responses.set(url, response);
        return this;
    }

    async post(url: string): Promise<Uint8Array> {
        return this.read(`POST ${url}`, url);
    }

    async get(url: string): Promise<Uint8Array> {
        return this.read(`GET ${url}`, url);
    }

    private read(call: string, url: string): Uint8Array {
        this.calls.push(call);
        const response = this.responses.get(url);

        if (response === undefined) {
            throw new Error(`Nothing was put in the stub for ${url}`);
        }

        if (response instanceof Error) {
            throw response;
        }

        return response;
    }
}

function certStatus(status: TestOcspStatus): asn1js.BaseBlock {
    if (status === 'revoked') {
        // [1] RevokedInfo, constructed: a revocation time, and no reason
        return new asn1js.Constructed({
            idBlock: { tagClass: 3, tagNumber: 1 },
            value: [new asn1js.GeneralizedTime({ valueDate: new Date('2026-10-01T00:00:00Z') })],
        });
    }

    return new asn1js.Primitive({
        idBlock: { tagClass: 3, tagNumber: status === 'good' ? 0 : 2 },
        lenBlock: { length: 0 },
    });
}

function distinguishedName(commonName: string): pkijs.RelativeDistinguishedNames {
    return new pkijs.RelativeDistinguishedNames({
        typesAndValues: [new pkijs.AttributeTypeAndValue({ type: '2.5.4.3', value: new asn1js.Utf8String({ value: commonName }) })],
    });
}
