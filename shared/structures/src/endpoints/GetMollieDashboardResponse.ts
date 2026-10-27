import { AutoEncoder, field, StringDecoder } from '@common/encoding';

export class GetMollieDashboardResponse extends AutoEncoder {
    @field({ decoder: StringDecoder })
    url: string;
}
