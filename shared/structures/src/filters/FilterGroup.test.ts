import { ObjectData } from "@simonbackx/simple-encoding";

import { FilterGroup, FilterGroupDecoder, FilterGroupEncoded } from "./FilterGroup";
import { StringFilterDefinition } from "./StringFilter";

class TestObject {
    name: string;
}

describe('FilterGroup', () => {
    it("Can encode and decode", () => {
        const definitions = [
            new StringFilterDefinition<TestObject>({
                id: "test-id",
                name: "Test filter",
                getValue: (o) => {
                    return o.name;
                }
            })
        ];
        const filter = definitions[0].createFilter()
        filter.value = "hello world";
        const group = new FilterGroup(definitions, [filter]);
        const encoded = group.encode({ version: 169 })
        const groupEncoded = new FilterGroupEncoded(encoded, 169);
        const savedEncoded = groupEncoded.encode({ version: 169 });

        // Now decode correctly
        const groupDecoded = FilterGroupEncoded.decode(new ObjectData(savedEncoded, { version: 169 }));

        // Decode with definitions
        const decodedGroup = groupDecoded.decode(definitions);
        expect(decodedGroup.filters).toEqual(group.filters);
    });

    it("Can encode and decode with changed definitions", () => {
        const definitions = [
            new StringFilterDefinition<TestObject>({
                id: "test-id",
                name: "Test filter",
                getValue: (o) => {
                    return o.name;
                }
            })
        ];
        const filter = definitions[0].createFilter()
        filter.value = "hello world";
        const group = new FilterGroup(definitions, [filter]);
        const encoded = group.encode({ version: 169 })
        const groupEncoded = new FilterGroupEncoded(encoded, 169);
        const savedEncoded = groupEncoded.encode({ version: 169 });

        // Now decode correctly
        const groupDecoded = FilterGroupEncoded.decode(new ObjectData(savedEncoded, { version: 169 }));

        // Decode with definitions
        const decodedGroup = groupDecoded.decode([]);
        expect(decodedGroup.filters).toEqual([]);
    });

    it("Can encode and decode from version 168", () => {
        const definitions = [
            new StringFilterDefinition<TestObject>({
                id: "test-id",
                name: "Test filter",
                getValue: (o) => {
                    return o.name;
                }
            })
        ];
        const filter = definitions[0].createFilter()
        filter.value = "hello world";
        const group = new FilterGroup(definitions, [filter]);
        const encoded = group.encode({ version: 168 })

        const groupEncoded = new FilterGroupEncoded(encoded, 168);
        const savedEncoded = groupEncoded.encode({ version: 168 });
        expect(savedEncoded).toEqual(encoded);

        // Now decode correctly from 169
        const groupDecoded = FilterGroupEncoded.decode(new ObjectData(savedEncoded, { version: 168 }));

        // Decode with definitions
        const decodedGroup = groupDecoded.decode(definitions);
        expect(decodedGroup.filters).toEqual(group.filters);

        // Also decode correctly from 168
        const groupDecodedFrom168 = new FilterGroupDecoder(definitions).decode(new ObjectData(savedEncoded, { version: 168 }));
        expect(groupDecodedFrom168.filters).toEqual(group.filters);
    });
});