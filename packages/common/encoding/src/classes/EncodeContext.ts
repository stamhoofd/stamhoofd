export enum EncodeMedium {
    /**
     * The object will be sent over the network.
     */
    Network = 'Network',

    /**
     * The object will be stored in the database.
     */
    Database = 'Database',
}

export interface EncodeContext {
    /** Wire/storage version, not the npm package version. Decode using the version used to encode. */
    version: number;
    references?: Map<any, any>; // class type -> id -> decoded object

    /**
     * When encoding, this is the storage type we encode to.
     * When deconding, this is the storage type we decode from.
     */
    medium?: EncodeMedium;
}
