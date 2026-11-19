export type BelcotaxMockApiRequest = {
    method: string;
    /**
     * Relative to the base URL of the API, without query string
     */
    path: string;
    /**
     * Company the access token was issued for
     */
    companyNumber: string;
    match: RegExpExecArray;
    /**
     * Raw request body, e.g. the multipart form of a submission
     */
    body: string;
    contentType: string | undefined;
};

export type BelcotaxMockApiResponse = [status: number, body: unknown];

export type BelcotaxMockApiRoute = {
    method: string;
    path: RegExp;
    handle(
        request: BelcotaxMockApiRequest,
    ): BelcotaxMockApiResponse | Promise<BelcotaxMockApiResponse>;
};

/**
 * RFC 9457 problem in the Belgif format FOD uses (§5.4 of "How to access FPS Finances's APIs")
 */
export function belcotaxProblem(status: number, type: string, title: string, detail: string) {
    return {
        type: 'urn:problem-type:belgif:' + type,
        href: `https://www.belgif.be/specification/rest/api-guide/problems/${type}.html`,
        status,
        title,
        detail,
    };
}
