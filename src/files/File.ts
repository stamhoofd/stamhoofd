import { Data,Encodeable, EncodeContext } from "@simonbackx/simple-encoding";

export class File implements Encodeable {
    id: string;

    /// Path to the server
    server: string;

    /// Path relative to the server
    path: string;

    /// file size in bytes
    size: number;

    constructor(data: { id: string; server: string; path: string; size: number }) {
        this.id = data.id;
        this.server = data.server
        this.path = data.path
        this.size = data.size
    }

    static decode(data: Data): File {
        return new File({
            id: data.field("id").string,
            server: data.field("server").string,
            path: data.field("path").string,
            size: data.field("size").integer,
        });
    }

    encode(context: EncodeContext) {
        return {
            id: this.id,
            server: this.server,
            path: this.path,
            size: this.size
        };
    }

    getPublicPath(): string {
        return this.server+"/"+this.path
    }
}
