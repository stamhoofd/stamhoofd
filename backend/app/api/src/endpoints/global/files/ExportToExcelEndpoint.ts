/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder, EncodableObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { ArchiverWriterAdapter, exportToExcel, XlsxTransformerSheet, XlsxWriter } from '@stamhoofd/excel-writer';
import { getEmailBuilderForTemplate, RateLimiter } from '@stamhoofd/models';
import { EmailTemplateType, ExcelExportRequest, ExcelExportResponse, ExcelExportType, LimitedFilteredRequest, PaginatedResponse, Recipient, Replacement } from '@stamhoofd/structures';
import { sleep } from "@stamhoofd/utility";
import { Context } from '../../../helpers/Context';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator';
import { FileCache } from '../../../helpers/FileCache';

type Params = { type: string };
type Query = undefined;
type Body = ExcelExportRequest;
type ResponseBody = ExcelExportResponse;

type ExcelExporter<T extends EncodableObject> = {
    fetch(request: LimitedFilteredRequest): Promise<PaginatedResponse<T[], LimitedFilteredRequest>>
    sheets: XlsxTransformerSheet<T, unknown>[]
}

export const limiter = new RateLimiter({
    limits: [
        {   
            // Max 200 per day
            limit: 200,
            duration: 60 * 1000 * 60 * 24
        }
    ]
});

export class ExportToExcelEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = ExcelExportRequest as Decoder<ExcelExportRequest>

    // Other endpoints can register exports here
    static loaders: Map<ExcelExportType, ExcelExporter<EncodableObject>> = new Map()

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/export/excel/@type", {type: String});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        const {user} = await Context.authenticate()

        const loader = ExportToExcelEndpoint.loaders.get(request.params.type as ExcelExportType);
        
        if (!loader) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Invalid type " + request.params.type,
                statusCode: 400
            })
        }

        limiter.track(user.id, 1);
        let sendEmail = false;

        const result = await Promise.race([
            this.job(loader, request.body, request.params.type).then(async (url: string) => {
                if (sendEmail) {
                    const builder = await getEmailBuilderForTemplate(organization, {
                        template: {
                            type: EmailTemplateType.ExcelExportSucceeded
                        },
                        recipients: [
                            user.createRecipient(Replacement.create({
                                token: 'downloadUrl',
                                value: url
                            }))
                        ],
                        from: Email.getInternalEmailFor(Context.i18n)
                    })
            
                    if (builder) {
                        Email.schedule(builder)
                    }

                }

                return url;
            }).catch(async (error) => {
                if (sendEmail) {
                    const builder = await getEmailBuilderForTemplate(organization, {
                        template: {
                            type: EmailTemplateType.ExcelExportFailed
                        },
                        recipients: [
                            user.createRecipient()
                        ],
                        from: Email.getInternalEmailFor(Context.i18n)
                    })
            
                    if (builder) {
                        Email.schedule(builder)
                    }
                }
                throw error
            }),
            sleep(3000)
        ])

        if (typeof result === 'string') {
            return new Response(ExcelExportResponse.create({
                url: result
            }))
        }
        
        // We'll send an e-mail
        // Let the job know to send an e-mail when it is done
        sendEmail = true;

        return new Response(ExcelExportResponse.create({
            url: null
        }))
    }

    async job(loader: ExcelExporter<EncodableObject>, request: ExcelExportRequest, type: string): Promise<string> {
        // Estimate how long it will take.
        // If too long, we'll schedule it and write it to Digitalocean Spaces
        // Otherwise we'll just return the file directly
        const {file, stream} = await FileCache.getWriteStream('.xlsx');

        const zipWriterAdapter = new ArchiverWriterAdapter(stream);
        const writer = new XlsxWriter(zipWriterAdapter);

        // Limit to pages of 100
        request.filter.limit = 100;

        await exportToExcel({
            definitions: loader.sheets,
            writer,
            dataGenerator: fetchToAsyncIterator(request.filter, loader),
            filter: request.workbookFilter
        })

        console.log('Done writing excel file')

        const url = 'https://'+ STAMHOOFD.domains.api + '/file-cache?file=' + encodeURIComponent(file) + '&name=' + encodeURIComponent(type)
        return url;
    }
}
