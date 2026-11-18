import { AutoEncoder, DateDecoder, field, StringDecoder } from '@common/encoding';
import { v4 as uuidv4 } from 'uuid';

import type { Company } from '../Company.js';

export const BelcotaxFeatureFlag = 'belcotax-api';

/**
 * The 10-digit KBO number FOD Financiën identifies a company by, or null when the company has
 * none. Only the format is checked: Belcotax validates the number itself.
 */
export function getBelcotaxCompanyNumber(company: Pick<Company, 'companyNumber'>): string | null {
    let value = (company.companyNumber ?? '').replace(/\D+/g, '');
    if (value.length === 9) {
        value = '0' + value;
    }
    return /^[019]\d{9}$/.test(value) ? value : null;
}

/**
 * The tokens never leave the server.
 */
export class BelcotaxConnection extends AutoEncoder {
    @field({ decoder: StringDecoder, defaultValue: () => uuidv4() })
    id: string;

    @field({ decoder: StringDecoder })
    companyNumber = '';

    /**
     * The legal representative who logged in at FOD Financiën
     */
    @field({ decoder: StringDecoder })
    representativeName = '';

    /**
     * The refresh token is single use and valid for 7 days. Every action exchanges it for a new one,
     * so the date moves along; after it, a legal representative has to log in again.
     */
    @field({ decoder: DateDecoder })
    validUntil = new Date();

    @field({ decoder: DateDecoder })
    createdAt = new Date();

    get isValid() {
        return this.validUntil > new Date();
    }
}

export class BelcotaxConnectRequest extends AutoEncoder {
    @field({ decoder: StringDecoder })
    companyId = '';

    /**
     * Page of the dashboard to return to after logging in at FOD Financiën
     */
    @field({ decoder: StringDecoder })
    redirectUri = '';

    /**
     * Returned unchanged with the result, so the dashboard can check it started this flow
     */
    @field({ decoder: StringDecoder })
    spaState = '';
}

export class BelcotaxConnectResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    authorizeUrl = '';
}
