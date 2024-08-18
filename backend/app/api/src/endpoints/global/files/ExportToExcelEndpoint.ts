/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Decoder, EncodableObject } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { ArchiverWriterAdapter, exportToExcel, XlsxTransformerSheet, XlsxWriter } from '@stamhoofd/excel-writer';
import { RateLimiter } from '@stamhoofd/models';
import { ExcelExportRequest, ExcelExportResponse, ExcelExportType, LimitedFilteredRequest, PaginatedResponse } from '@stamhoofd/structures';
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
        await Context.setOptionalOrganizationScope();
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

        // Estimate how long it will take.
        // If too long, we'll schedule it and write it to Digitalocean Spaces
        // Otherwise we'll just return the file directly
        const {file, stream} = await FileCache.getWriteStream('.xlsx');

        const zipWriterAdapter = new ArchiverWriterAdapter(stream);
        const writer = new XlsxWriter(zipWriterAdapter);

        // Limit to pages of 100
        request.body.filter.limit = 100;

        await exportToExcel({
            definitions: loader.sheets,
            writer,
            dataGenerator: fetchToAsyncIterator(request.body.filter, loader),
            filter: request.body.workbookFilter
        })
        
        console.log('Done writing excel file')
        return new Response(ExcelExportResponse.create({
            url: 'https://'+ STAMHOOFD.domains.api + '/file-cache?file=' + encodeURIComponent(file) + '&name=' + encodeURIComponent(request.params.type)
        }))
    }
}
