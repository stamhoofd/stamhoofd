import { Data } from "./Data";

export interface Decoder<T> {
    decode(data: Data): T;
}