import type { AutoEncoderPatchType } from '@simonbackx/simple-encoding';
import { isSimpleError, isSimpleErrors, SimpleError } from '@simonbackx/simple-errors';
import { ViesCachedResult } from '@stamhoofd/models/models/ViesCachedResult.js';
import type { Company } from '@stamhoofd/structures';
import { PeppolScheme } from '@stamhoofd/structures';
import { Country } from '@stamhoofd/types/Country';
import jsvat from 'jsvat-next';
import { PeppolDirectoryService } from './PeppolDirectoryService.js';
import { ViesApi } from './ViesApi.js';

const CacheMonths = 6;

export class ViesServiceStatic {

    async checkCompany(company: Company, patch: AutoEncoderPatchType<Company> | Company) {
        // Validate the custom PEPPOL endpoint id, but only when it actually changed.
        // In a patch, `customPeppolEndpointId` is undefined unless the client changed it;
        // for a full company it is always set (null or a value), so we validate a set value.
        if (patch.customPeppolEndpointId !== undefined && company.customPeppolEndpointId) {
            const endpointId = company.customPeppolEndpointId;

            // A KBO (0208) endpoint id is the Belgian enterprise number, so it must belong to a
            // Belgian company and be identical to this company's own company number.
            if (endpointId.schemeID === (PeppolScheme.KBO as string)) {
                if (company.address?.country !== Country.Belgium) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'A KBO PEPPOL id can only be used for a Belgian company',
                        human: $t('%Zck'),
                        field: 'customPeppolEndpointId',
                    });
                }

                const companyPeppolId = company.peppolCompanyId;
                if (!companyPeppolId || endpointId.id.replace(/\D+/g, '') !== companyPeppolId.id.replace(/\D+/g, '')) {
                    throw new SimpleError({
                        code: 'invalid_field',
                        message: 'A KBO PEPPOL id must match the company number',
                        human: $t('%ZcZ'),
                        field: 'customPeppolEndpointId',
                    });
                }
            }

            // validate() fills in the server-controlled entityName from the PEPPOL directory.
            await PeppolDirectoryService.validate(endpointId);

            // Write the validated endpoint id back as a full replacement so any client-supplied
            // entityName is discarded: entityName can only ever be set by the server.
            patch.customPeppolEndpointId = endpointId;
        }

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
                human: $t('%1LF'),
                field: 'companyName',
            });
        }

        if (company.VATNumber !== null) {
            // Changed VAT number
            const VATNumber = await this.checkVATNumber(company.address.country, company.VATNumber);
            patch.VATNumber = VATNumber;

            if (company.address.country === Country.Belgium) {
                patch.companyNumber = VATNumber.substring(2);
            }
        }

        if (company.companyNumber) {
            if (company.VATNumber !== null && company.address.country === Country.Belgium) {
                // Already validated
            } else {
                // Need to validate
                const result = await this.checkCompanyNumber(company.address.country, company.companyNumber);
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
        } catch (e) {
            if ((isSimpleError(e) || isSimpleErrors(e)) && e.hasCode('invalid_field')) {
                // Ignore: normal that it is not a valid VAT number
            } else {
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
                message: $t('%1To', { number: vatNumber }),
                field: 'VATNumber',
            });
        }

        const formatted = result.value ?? vatNumber;

        if (STAMHOOFD.environment === 'development' && formatted === 'NL301828519B01') {
            return formatted;
        }

        try {
            if (!await this.isVATNumberValid(country, formatted)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: $t('%1TG', { 'vat-number': formatted }),
                    field: 'VATNumber',
                });
            }
        } catch (e) {
            if (isSimpleError(e) || isSimpleErrors(e)) {
                throw e;
            }
            // Unavailable: ignore for now
            throw new SimpleError({
                code: 'service_unavailable',
                message: $t('%1Sf'),
                field: 'VATNumber',
            });
        }

        return formatted;
    }

    private async isVATNumberValid(country: Country, VATNumber: string): Promise<boolean> {
        const cached = await ViesCachedResult.getByID(VATNumber);

        const freshAfter = new Date();
        freshAfter.setMonth(freshAfter.getMonth() - CacheMonths);

        if (cached && cached.checkedAt >= freshAfter) {
            return cached.result;
        }

        let result: boolean;
        try {
            result = await ViesApi.checkVATNumber(country, VATNumber);
        }
        catch (error) {
            console.error('VIES error', error);
            if (cached) {
                return cached.result;
            }
            throw error;
        }

        await ViesCachedResult.saveResult(VATNumber, result, new Date());
        return result;
    }
}

export const ViesService = new ViesServiceStatic();
