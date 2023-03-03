import { AutoEncoder, EnumDecoder,field, IntegerDecoder } from '@simonbackx/simple-encoding';

export enum ResolutionFit {
    Contain = "contain",
    Cover = "cover",
    Fill = "fill",
    Inside = "inside",
    Outside = "outside",
}

export class ResolutionRequest extends AutoEncoder {
    @field({ decoder: IntegerDecoder, nullable: true})
    width: number | null = null

    @field({ decoder: IntegerDecoder, nullable: true})
    height: number | null = null;

    @field({ decoder: new EnumDecoder(ResolutionFit) })
    fit: ResolutionFit = ResolutionFit.Inside
}