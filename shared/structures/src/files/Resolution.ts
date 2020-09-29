import { Data,Encodeable, EncodeContext } from "@simonbackx/simple-encoding";

import { File } from "./File"

export class Resolution implements Encodeable {
    /// Path to the server
    file: File;
    width: number;
    height: number;

    constructor(data: { file: File; width: number; height: number }) {
        this.file = data.file
        this.width = data.width
        this.height = data.height
    }


    static decode(data: Data): Resolution {
        return new Resolution({
            file: data.field("file").decode(File),
            width: data.field("width").integer,
            height: data.field("height").integer,
        });
    }

    encode(context: EncodeContext) {
        return {
            file: this.file.encode(context),
            width: this.width,
            height: this.height
        };
    }
}
