import { ArrayDecoder, AutoEncoder, field, NumberDecoder, StringDecoder } from '@common/encoding';

export class GraphData extends AutoEncoder {
    @field({ decoder: StringDecoder })
    label: string = '';

    @field({ decoder: new ArrayDecoder(NumberDecoder) })
    values: number[] = [];
}

export class Graph extends AutoEncoder {
    @field({ decoder: new ArrayDecoder(StringDecoder) })
    labels: string[] = [];

    @field({ decoder: new ArrayDecoder(GraphData) })
    data: GraphData[] = [];
}
