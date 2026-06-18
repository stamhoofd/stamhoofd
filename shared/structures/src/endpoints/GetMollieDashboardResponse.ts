import { AutoEncoder, field, StringDecoder } from '@simonbackx/simple-encoding';

export class GetMollieDashboardResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string;
}
