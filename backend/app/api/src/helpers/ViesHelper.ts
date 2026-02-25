import { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { Company, Country } from '@stamhoofd/structures';
import axios from 'axios';
import * as jsvat from 'jsvat-next'; // has no default export, so we need the wildcard

export class ViesHelperStatic {
    testMode = false;

    async request(method: 'GET' | 'POST', url: string, content: any) {
        const json = content ? JSON.stringify(content) : '';

        console.log('[VIES REQUEST]', method, url, content ? '\n [VIES REQUEST] ' : undefined, json);

        const response = await axios.request({
            method,
            url,
            headers: {
                'Content-Type': json.length > 0 ? 'application/json' : 'text/plain',
            },
            data: json,

        });
        console.log('[VIES RESPONSE]', method, url, '\n[VIES RESPONSE]', JSON.stringify(response.data));
        return response.data;
    }

    async checkCompany(company: Company, patch: AutoEncoderPatchType<Company> | Company) {
        if (!company.address) {
            // Not allowed to set
            patch.companyNumber = null;
            patch.VATNumber = null;
            return;
        }

        if (company.name.length < 3 || company.name.toLowerCase() === 'vzw') {
            throw new SimpleError({
                code: 'invalid_company_name',
                message: 'Company name is too short',
                human: $t('De bedrijfsnaam is te kort of ongeldig. Vul een geldige bedrijfsnaam in.'),
                field: 'companyName',
            });
        }

        if (company.VATNumber !== null) {
            // Changed VAT number
            patch.VATNumber = await ViesHelper.checkVATNumber(company.address.country, company.VATNumber);

            if (company.address.country === Country.Belgium) {
                patch.companyNumber = company.VATNumber.substring(2);
            }
        }

        if (company.companyNumber) {
            if (company.VATNumber !== null && company.address.country === Country.Belgium) {
                // Already validated
            }
            else {
                // Need to validate
                const result = await ViesHelper.checkCompanyNumber(company.address.country, company.companyNumber);
                patch.companyNumber = result.companyNumber;
                if (result.VATNumber !== undefined) {
                    patch.VATNumber = result.VATNumber;
                }
            }
        }
    }

    async checkCompanyNumber(country: Country, companyNumber: string): Promise<{ companyNumber: string | null; VATNumber?: string | null }> {
        if (country !== Country.Belgium) {
            // Not supported
            return {
                companyNumber,
            };
        }

        // In Belgium, the company number syntax is the same as VAT number
        let correctedVATNumber = companyNumber;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        if (companyNumber.length > 2 && companyNumber.substr(0, 2).toUpperCase() !== country) {
            // Add required country in VAT number
            correctedVATNumber = country + companyNumber;
        }

        const result = jsvat.checkVAT(correctedVATNumber, [jsvat.belgium]);

        if (!result.isValid) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Ongeldig ondernemingsnummer: ' + companyNumber,
                field: 'companyNumber',
            });
        }

        // If this is a valid VAT number, we can assume it's a valid company number
        try {
            const corrected = await this.checkVATNumber(Country.Belgium, correctedVATNumber);

            // this is a VAT number, not a company number
            return {
                companyNumber: corrected.substring(2),
                VATNumber: corrected,
            };
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                // Ignore: normal that it is not a valid VAT number
            }
            else {
                // Other errors should be thrown
                throw e;
            }
        }

        return {
            companyNumber: result.value?.substring(2) ?? companyNumber,

            // VATNumber should always be set to null if it is not a valid VAT number
            VATNumber: null,
        };
    }

    async checkVATNumber(country: Country, vatNumber: string): Promise<string> {
        const result = jsvat.checkVAT(vatNumber, country === Country.Belgium ? [jsvat.belgium] : [jsvat.netherlands]);

        if (!result.isValid) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Ongeldig BTW-nummer: ' + vatNumber,
                field: 'VATNumber',
            });
        }

        const formatted = result.value ?? vatNumber;

        try {
            const cleaned = formatted.substring(2).replace(/(\.-\s)+/g, '');
            const response = await this.request('POST', 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number', {
                countryCode: country,
                vatNumber: cleaned,
            });

            if (typeof response !== 'object' || response === null || typeof response.valid !== 'boolean') {
                // APi error
                throw new Error('Invalid response from VIES');
            }

            if (!response.valid) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'Het opgegeven BTW-nummer is ongeldig of niet BTW-plichtig: ' + formatted,
                    field: 'VATNumber',
                });
            }
        }
        catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                throw e;
            }
            // Unavailable: ignore for now
            console.error('VIES error', e);

            throw new SimpleError({
                code: 'service_unavailable',
                message: 'De BTW-nummer validatie service (VIES) is tijdelijk niet beschikbaar. Probeer het later opnieuw.',
                field: 'VATNumber',
            });
        }

        return formatted;
    }
}

export const ViesHelper = new ViesHelperStatic();
