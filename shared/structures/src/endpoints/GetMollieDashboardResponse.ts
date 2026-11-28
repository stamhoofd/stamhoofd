import { AutoEncoder, field, StringDecoder } from '@stamhoofd/common-encoding';

export class GetMollieDashboardResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string;
}
