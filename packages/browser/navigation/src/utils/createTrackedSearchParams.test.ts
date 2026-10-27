import { describe } from "node:test";
import { createTrackedSearchParams } from "./createTrackedSearchParams.js";

describe('createTrackedSearchParams',() => {
    test('.get', () => {
        const params = new URLSearchParams([
            ['code', 'test']
        ]);
        const tracked = createTrackedSearchParams(params);
        expect(tracked.params.get('code')).toEqual('test')
        expect(tracked.getReadKeys()).toEqual(['code']);
    })

    test('.has', () => {
        const params = new URLSearchParams([
            ['code', 'test']
        ]);
        const tracked = createTrackedSearchParams(params);
        expect(tracked.params.has('other')).toEqual(false)
        expect(tracked.getReadKeys()).toEqual(['other']);
    })
});