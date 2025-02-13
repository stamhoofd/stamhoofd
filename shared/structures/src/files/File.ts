import { Data, Encodeable, EncodeContext } from '@simonbackx/simple-encoding';

export class File implements Encodeable {
    id: string;

    /// Path to the server
    server: string;

    name: string | null;

    /// Path relative to the server
    path: string;

    /// file size in bytes
    size: number;

    /// private or not?
    isPrivate: boolean = false;

    /// signed url if it is a private file
    /// only filled if you have access to this file
    signedUrl: string | null = null;

    constructor(data: { id: string; server: string; path: string; size: number; name?: string | null; isPrivate?: boolean; signedUrl?: string | null }) {
        this.id = data.id;
        this.server = data.server;
        this.path = data.path;
        this.size = data.size;
        this.name = data.name ?? null;
        this.isPrivate = data.isPrivate ?? false;
        this.signedUrl = data.signedUrl ?? null;
    }

    static decode(data: Data): File {
        return new File({
            id: data.field('id').string,
            server: data.field('server').string,
            path: data.field('path').string,
            size: data.field('size').integer,
            name: data.optionalField('name')?.string ?? null,

            isPrivate: data.optionalField('isPrivate')?.boolean ?? false,
            signedUrl: data.optionalField('signedUrl')?.string ?? null,
        });
    }

    encode(context: EncodeContext) {
        return {
            id: this.id,
            server: this.server,
            path: this.path,
            size: this.size,
            name: this.name,
            isPrivate: this.isPrivate,
            signedUrl: this.signedUrl,
        };
    }

    getPublicPath(): string {
        if (this.signedUrl && this.isPrivate) {
            return this.signedUrl;
        }
        return this.server + '/' + this.path;
    }
}
