import { ArrayDecoder,AutoEncoder, Data,field, StringDecoder } from "@simonbackx/simple-encoding";
import { v4 as uuidv4 } from "uuid";

import { File } from './File';
import { Resolution } from './Resolution';

export class Image extends AutoEncoder {
    @field({decoder: StringDecoder, defaultValue: () => uuidv4()})
    id: string;

    @field({ decoder: File })
    source: File;
    
    @field({decoder: new ArrayDecoder(Resolution) })
    resolutions: Resolution[] = []
   
    getPublicPath(): string {
        if (this.resolutions.length > 0) {
            return this.resolutions[0].file.getPublicPath()
        }
        return this.source.getPublicPath()
    }

    getPathForSize(width: number | undefined, height: number | undefined): string {
        if (this.resolutions.length == 0) {
            return this.getPublicPath()
        }
        const resolution = this.getResolutionForSize(width, height);
        return resolution.file.getPublicPath()
    }

    getResolutionForSize(width: number | undefined, height: number | undefined): Resolution {
        let bestResolution: Resolution | undefined

        const ratio = (
            (typeof window !== "undefined") ? ((window as any).devicePixelRatio ? (window as any).devicePixelRatio : 1) : 1
            ) ?? 1;
        if (ratio >= 2 && width) {
            width = ratio * width;
        }
        if (ratio >= 2 && height) {
            height = ratio * height;
        }

        // Search resolution bigger than width x height, but smaller than any other resolution that is bigger
        for(const resolution of this.resolutions) {
            if (
                (bestResolution === undefined || ( (!width || resolution.width <= bestResolution.width) && (!height || resolution.height <= bestResolution.height))) &&
                (!width || resolution.width >= width) &&
                (!height || resolution.height >= height)
            ) {
                bestResolution = resolution;
            }
        }

        if (bestResolution) {
            return bestResolution;
        }

        // Get biggest resolution possible of we don't find anything bigger
        for(const resolution of this.resolutions) {

            if (bestResolution === undefined || (resolution.width >= bestResolution.width && resolution.height >= bestResolution.height)) {
                bestResolution = resolution;
            }
        }

        if (bestResolution) {
            return bestResolution;
        }

        throw new Error("No resolution found. Please first check if the image has resolutions")
    }
}
