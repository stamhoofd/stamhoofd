/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder, EncodableObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/email';
import { ArchiverWriterAdapter, exportToExcel, XlsxTransformerSheet, XlsxWriter } from '@stamhoofd/excel-writer';
import { getEmailBuilderForTemplate, Platform, RateLimiter, sendEmailTemplate } from '@stamhoofd/models';
import { EmailTemplateType, ExcelExportRequest, ExcelExportResponse, ExcelExportType, LimitedFilteredRequest, PaginatedResponse, Recipient, Replacement, Version } from '@stamhoofd/structures';
import { sleep } from "@stamhoofd/utility";
import { Context } from '../../../helpers/Context';
import { fetchToAsyncIterator } from '../../../helpers/fetchToAsyncIterator';
import { FileCache } from '../../../helpers/FileCache';
import { QueueHandler } from '@stamhoofd/queues';

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

        if (user.isApiUser) {
            throw new SimpleError({
                code: "not_allowed",
                message: "API users are not allowed to export to Excel. The Excel export endpoint has a side effect of sending e-mails. Please use normal API endpoints to get the data you need.",
                statusCode: 403
            })
        }

        if (QueueHandler.isRunning('user-export-to-excel-' + user.id)) {
            throw new SimpleError({
                code: "not_allowed",
                message: "Export is pending",
                human: 'Je hebt momenteel al een Excel export lopen. Wacht tot die klaar is voor je een nieuwe export start.',
                statusCode: 403
            })
        }

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

        await Platform.getSharedStruct();

        const result = await Promise.race([
            this.job(loader, request.body, request.params.type).then(async (url: string) => {
                if (sendEmail) {
                    await sendEmailTemplate(null, {
                        template: {
                            type: EmailTemplateType.ExcelExportSucceeded
                        },
                        recipients: [
                            user.createRecipient(Replacement.create({
                                token: 'downloadUrl',
                                value: url
                            }))
                        ]
                    })

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
        // Only run 1 export per user at the same time
        return await QueueHandler.schedule('user-export-to-excel-' + Context.user!.id, async () => {
            // Allow maximum 2 running Excel jobs at the same time for all users
            return await QueueHandler.schedule('export-to-excel', async () => {
                // Estimate how long it will take.
                // If too long, we'll schedule it and write it to Digitalocean Spaces
                // Otherwise we'll just return the file directly
                const {file, stream} = await FileCache.getWriteStream('.xlsx');

                const zipWriterAdapter = new ArchiverWriterAdapter(stream);
                const writer = new XlsxWriter(zipWriterAdapter);

                // Limit to pages of 100
                request.filter.limit = STAMHOOFD.environment === 'development' ? 1 : 100; // in development, we need to check if total count matches and pagination is working correctly

                await exportToExcel({
                    definitions: loader.sheets,
                    writer,
                    dataGenerator: fetchToAsyncIterator(request.filter, loader),
                    filter: request.workbookFilter
                })

                console.log('Done writing excel file')

                const url = 'https://'+ STAMHOOFD.domains.api + '/v'+ Version +'/file-cache?file=' + encodeURIComponent(file) + '&name=' + encodeURIComponent(type)
                return url;
            }, 2)
        });
    }
}
