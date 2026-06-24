import { Address, Company } from '@stamhoofd/structures';
import { STExpect, TestUtils } from '@stamhoofd/test-utils';
import { Country } from '@stamhoofd/types/Country';
import nock from 'nock';
import { ViesHelper } from './ViesHelper.js';

const VIES_HOST = 'https://ec.europa.eu';
const VIES_PATH = '/taxation_customs/vies/rest-api/check-vat-number';

describe('ViesHelper', () => {
    /**
     * Registers a mock for the (only) external dependency: the VIES check-vat-number endpoint.
     * Returns the nock scope so tests can assert whether it was actually called.
     */
    function mockVies(response: unknown, statusCode = 200) {
        return nock(VIES_HOST).post(VIES_PATH).reply(statusCode, response as nock.Body);
    }

    /**
     * Captures the JSON body that was sent to the VIES endpoint, so we can assert
     * what we send without depending on the internals of the helper.
     */
    function mockViesCapturingBody(response: unknown, statusCode = 200): { getBody: () => any } {
        let body: any;
        nock(VIES_HOST)
            .post(VIES_PATH, (requestBody) => {
                body = requestBody;
                return true;
            })
            .reply(statusCode, response as nock.Body);
        return { getBody: () => body };
    }

    afterEach(() => {
        nock.cleanAll();
        nock.disableNetConnect();
    });

    describe('checkVATNumber', () => {
        describe('rejects invalid numbers before contacting the API', () => {
            test('an invalid Belgian VAT number is rejected without a request', async () => {
                const scope = mockVies({ valid: true });

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0123')).rejects.toThrow(
                    STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
                );

                // The VIES endpoint must not have been called.
                expect(scope.isDone()).toBe(false);
            });

            test('an invalid Dutch VAT number is rejected without a request', async () => {
                const scope = mockVies({ valid: true });

                await expect(ViesHelper.checkVATNumber(Country.Netherlands, 'NL123456789B01')).rejects.toThrow(
                    STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
                );

                expect(scope.isDone()).toBe(false);
            });

            test('garbage input is rejected without a request', async () => {
                const scope = mockVies({ valid: true });

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'not-a-vat-number')).rejects.toThrow(
                    STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber' }),
                );

                expect(scope.isDone()).toBe(false);
            });

            test('the error message contains the rejected number', async () => {
                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0123')).rejects.toThrow(
                    STExpect.simpleError({ code: 'invalid_field', field: 'VATNumber', message: /Ongeldig BTW-nummer.*BE0123/ }),
                );
            });
        });

        describe('parses the API response', () => {
            test('returns the formatted number when VIES confirms it is valid', async () => {
                const scope = mockVies({ valid: true });

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0411905847')).resolves.toBe('BE0411905847');

                // The number was actually validated against VIES.
                expect(scope.isDone()).toBe(true);
            });

            test('sends the country code and the cleaned number (without country prefix) to VIES', async () => {
                const mock = mockViesCapturingBody({ valid: true });

                await ViesHelper.checkVATNumber(Country.Belgium, 'BE0411905847');

                expect(mock.getBody()).toEqual({
                    countryCode: 'BE',
                    vatNumber: '0411905847',
                });
            });

            test('validates Dutch numbers against VIES as well', async () => {
                const mock = mockViesCapturingBody({ valid: true });

                await expect(ViesHelper.checkVATNumber(Country.Netherlands, 'NL301828519B01')).resolves.toBe('NL301828519B01');

                expect(mock.getBody()).toEqual({
                    countryCode: 'NL',
                    vatNumber: '301828519B01',
                });
            });

            test('throws an invalid_field error when VIES reports the number as not valid', async () => {
                mockVies({ valid: false });

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0411905847')).rejects.toThrow(
                    STExpect.simpleError({
                        code: 'invalid_field',
                        field: 'VATNumber',
                        message: /BTW-plichtig.*BE0411905847/,
                    }),
                );
            });

            test('throws service_unavailable when VIES returns a response without a valid boolean', async () => {
                mockVies({ somethingElse: true });

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0411905847')).rejects.toThrow(
                    STExpect.simpleError({ code: 'service_unavailable', field: 'VATNumber' }),
                );
            });

            test('throws service_unavailable when VIES returns a non-object response', async () => {
                mockVies('"plain string"');

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0411905847')).rejects.toThrow(
                    STExpect.simpleError({ code: 'service_unavailable', field: 'VATNumber' }),
                );
            });

            test('throws service_unavailable when the VIES endpoint errors out', async () => {
                mockVies({ message: 'Internal Server Error' }, 500);

                await expect(ViesHelper.checkVATNumber(Country.Belgium, 'BE0411905847')).rejects.toThrow(
                    STExpect.simpleError({ code: 'service_unavailable', field: 'VATNumber' }),
                );
            });
        });

        test('skips the API in development for the known development number', async () => {
            TestUtils.setEnvironment('environment', 'development');
            const scope = mockVies({ valid: false });

            await expect(ViesHelper.checkVATNumber(Country.Netherlands, 'NL301828519B01')).resolves.toBe('NL301828519B01');

            // No request was made, even though VIES would have reported it invalid.
            expect(scope.isDone()).toBe(false);
        });
    });

    describe('checkCompanyNumber', () => {
        test('returns the number unchanged for non-Belgian countries without contacting the API', async () => {
            const scope = mockVies({ valid: true });

            const result = await ViesHelper.checkCompanyNumber(Country.Netherlands, '12345678');

            expect(result).toEqual({ companyNumber: '12345678' });
            expect(scope.isDone()).toBe(false);
        });

        test('rejects an invalid Belgian company number without contacting the API', async () => {
            const scope = mockVies({ valid: true });

            await expect(ViesHelper.checkCompanyNumber(Country.Belgium, '123')).rejects.toThrow(
                STExpect.simpleError({ code: 'invalid_field', field: 'companyNumber', message: /Ongeldig ondernemingsnummer: 123/ }),
            );

            expect(scope.isDone()).toBe(false);
        });

        test('promotes a valid Belgian company number to a VAT number when VIES confirms it', async () => {
            mockVies({ valid: true });

            const result = await ViesHelper.checkCompanyNumber(Country.Belgium, '0411905847');

            expect(result).toEqual({
                companyNumber: '0411905847',
                VATNumber: 'BE0411905847',
            });
        });

        test('keeps the company number but clears the VAT number when VIES does not recognise it', async () => {
            mockVies({ valid: false });

            const result = await ViesHelper.checkCompanyNumber(Country.Belgium, '0411905847');

            expect(result).toEqual({
                companyNumber: '0411905847',
                VATNumber: null,
            });
        });
    });

    describe('checkCompany', () => {
        const belgianAddress = () => Address.create({
            street: 'Demostraat',
            number: '12',
            city: 'Gent',
            postalCode: '9000',
            country: Country.Belgium,
        });

        test('clears both numbers when the company has no address, without contacting the API', async () => {
            const scope = mockVies({ valid: true });

            const company = Company.create({
                name: 'Demo Company',
                VATNumber: 'BE0411905847',
                companyNumber: '0411905847',
                address: null,
            });
            const patch = Company.create({});

            await ViesHelper.checkCompany(company, patch);

            expect(patch.VATNumber).toBeNull();
            expect(patch.companyNumber).toBeNull();
            expect(scope.isDone()).toBe(false);
        });

        test('rejects a company name that is too short', async () => {
            const company = Company.create({
                name: 'ab',
                address: belgianAddress(),
            });

            await expect(ViesHelper.checkCompany(company, Company.create({}))).rejects.toThrow(
                STExpect.simpleError({ code: 'invalid_company_name', field: 'companyName' }),
            );
        });

        test('validates the VAT number and derives the company number for a Belgian company', async () => {
            mockVies({ valid: true });

            const company = Company.create({
                name: 'Demo Company',
                VATNumber: 'BE0411905847',
                companyNumber: null,
                address: belgianAddress(),
            });
            const patch = Company.create({});

            await ViesHelper.checkCompany(company, patch);

            expect(patch.VATNumber).toBe('BE0411905847');
            expect(patch.companyNumber).toBe('0411905847');
        });
    });
});
