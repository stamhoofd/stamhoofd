import { Data } from '../classes/Data.js';
import { ObjectData } from '../classes/ObjectData.js';
import { Patchable } from '../classes/Patchable.js';
import { PatchableArray, PatchableArrayDecoder } from './PatchableArray.js';
import StringDecoder from './StringDecoder.js';

class Patch implements Patchable<Patch> {
    id: string;
    name: string | undefined;
    description: string | undefined;

    constructor(data: { id: string; name?: string; description?: string }) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
    }

    patch(patch: Patch): this {
        return new Patch({
            id: this.id,
            name: patch.name ?? this.name,
            description: patch.description ?? this.description,
        }) as this;
    }

    encode() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
        };
    }

    static decode(data: Data): Patch {
        return new Patch({
            id: data.field('id').string,
            name: data.optionalField('name')?.string,
            description: data.optionalField('description')?.string,
        });
    }
}

class Put implements Patchable<Put> {
    id: string;
    name: string;
    description: string;

    constructor(data: { id: string; name: string; description: string }) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
    }

    patch(patch: Patch): this {
        return new Put({
            id: this.id,
            name: patch.name ?? this.name,
            description: patch.description ?? this.description,
        }) as this;
    }

    encode() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
        };
    }

    static decode(data: Data): Put {
        return new Put({
            id: data.field('id').string,
            name: data.field('name').string,
            description: data.field('description').string,
        });
    }
}

describe('PatchableArray', () => {
    test('Integer based array', () => {
        const currentValue = [8, 5, 3, 1];

        const patchableArray = new PatchableArray<number, number, number>();
        patchableArray.addPut(9, 3);

        expect(patchableArray.applyTo(currentValue)).toEqual([8, 5, 3, 9, 1]);

        patchableArray.addPut(10, 9);
        patchableArray.addPut(11, 9);

        expect(patchableArray.applyTo(currentValue)).toEqual([8, 5, 3, 9, 11, 10, 1]);

        patchableArray.addDelete(3);

        expect(patchableArray.applyTo(currentValue)).toEqual([8, 5, 9, 11, 10, 1]);

        patchableArray.addMove(8, 1);

        expect(patchableArray.applyTo(currentValue)).toEqual([5, 9, 11, 10, 1, 8]);

        patchableArray.addMove(1, null);

        expect(patchableArray.applyTo(currentValue)).toEqual([1, 5, 9, 11, 10, 8]);
        patchableArray.addPut(12, null);
        expect(patchableArray.applyTo(currentValue)).toEqual([12, 1, 5, 9, 11, 10, 8]);
    });

    test('Object based array', () => {
        const currentValue = [];
        const patchableArray = new PatchableArray<string, Put, Patch>();

        const A = new Put({ id: 'A', name: 'Letter A', description: 'This is a letter' });
        const B = new Put({ id: 'B', name: 'Letter B', description: 'This is a letter' });
        const BResult = new Put({ id: 'B', name: 'Letter B', description: 'This is the best letter' });
        const BResultLast = new Put({ id: 'B', name: 'The letter B', description: 'This is the best letter' });

        patchableArray.addPut(A, null);
        expect(patchableArray.applyTo(currentValue)).toEqual([A]);
        expect(patchableArray.changes.length).toEqual(1);

        patchableArray.addPut(B, A.id);
        expect(patchableArray.applyTo(currentValue)).toEqual([A, B]);
        expect(patchableArray.changes.length).toEqual(2);

        const betterDescription = new Patch({ id: 'B', description: 'This is the best letter' });
        patchableArray.addPatch(betterDescription);
        expect(patchableArray.applyTo(currentValue)).toEqual([A, BResult]);
        expect(patchableArray.changes.length).toEqual(2);

        patchableArray.addMove(A.id, B.id);
        expect(patchableArray.applyTo(currentValue)).toEqual([BResult, A]);
        expect(patchableArray.changes.length).toEqual(3);

        const betterName = new Patch({ id: 'B', name: 'The letter B' });
        patchableArray.addPatch(betterName);
        expect(patchableArray.applyTo(currentValue)).toEqual([BResultLast, A]);
        expect(patchableArray.changes.length).toEqual(3);

        patchableArray.addDelete(B.id);
        expect(patchableArray.applyTo(currentValue)).toEqual([A]);
        expect(patchableArray.changes.length).toEqual(2);

        // Test the decoding and encoding
        const encoded = patchableArray.encode({ version: 0 });
        const decoder = new PatchableArrayDecoder(Put, Patch, StringDecoder);
        const decoded = decoder.decode(new ObjectData(encoded, { version: 0 }));
        expect(decoded).toEqual(patchableArray);

        // Check if still results in the same result
        expect(decoded.applyTo(currentValue)).toEqual([A]);
    });

    test('filtering', () => {
        const patchableArray = new PatchableArray<string, Put, Patch>();

        const A = new Put({ id: 'A', name: 'Letter A', description: 'This is a letter' });
        const B = new Put({ id: 'B', name: 'Letter B', description: 'This is a letter' });
        const BResult = new Put({ id: 'B', name: 'Letter B', description: 'This is the best letter' });
        const AResult = new Put({ id: 'A', name: 'The letter A', description: 'This is a letter' });

        patchableArray.addPut(A, null);
        // patchableArray.addPut(B, A.id);
        const betterDescription = new Patch({ id: 'B', description: 'This is the best letter' });
        patchableArray.addPatch(betterDescription);
        patchableArray.addMove(A.id, B.id);
        const betterName = new Patch({ id: 'A', name: 'The letter A' });
        patchableArray.addPatch(betterName);

        // Check patchable array remains untouched after useless filter
        patchableArray.filter('C');

        // Real filter
        const filtered = patchableArray.filter(A.id);
        expect(filtered.changes).toEqual([{ afterId: null, put: AResult }]);

        expect(patchableArray.changes).toEqual([{ patch: betterDescription }, { move: A.id, afterId: B.id }]);
        patchableArray.addDelete(B.id);
        expect(patchableArray.changes).toEqual([{ move: A.id, afterId: B.id }, { delete: B.id }]);

        const filtered2 = patchableArray.filter(B.id);
        expect(patchableArray.changes).toEqual([{ move: A.id, afterId: B.id }]);
        expect(filtered2.changes).toEqual([{ delete: B.id }]);
    });
});
