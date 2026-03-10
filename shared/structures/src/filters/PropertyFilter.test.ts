import { PropertyFilter } from './PropertyFilter.js';

describe('PropertyFilter', () => {
    describe('merge', () => {
        test('two optional properties merged stay optional', () => {
            const a = new PropertyFilter(null, null);
            const b = new PropertyFilter(null, null);
            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual(null);
            expect(mergedA.requiredWhen).toEqual(null);

            // Check ordering does not matter
            expect(mergedA).toEqual(mergedB);
        });

        test('two required properties merged stay required', () => {
            const a = new PropertyFilter(null, {});
            const b = new PropertyFilter(null, {});
            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual(null);
            expect(mergedA.requiredWhen).toEqual({});

            // Check ordering does not matter
            expect(mergedA).toEqual(mergedB);
        });

        test('one optional and one required property merge as required', () => {
            const a = new PropertyFilter(null, null);
            const b = new PropertyFilter(null, {});
            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual(null);
            expect(mergedA.requiredWhen).toEqual({});

            // Check ordering does not matter
            expect(mergedA).toEqual(mergedB);
        });

        test('one optional and one sometimes required property merge as optional that is sometimes required', () => {
            const a = new PropertyFilter(null, null);
            const b = new PropertyFilter({
                age: {
                    $gt: 14,
                },
            }, {}); // enabled when 14+, required when enabled

            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual(null); // always enabled
            expect(mergedA.requiredWhen).toEqual({
                age: {
                    $gt: 14,
                },
            }); // only required when 14+

            // Check ordering does not matter
            expect(mergedA).toEqual(mergedB);
        });

        test('one required and one sometimes required property merge as always required', () => {
            const a = new PropertyFilter(null, {}); // always required
            const b = new PropertyFilter({
                age: {
                    $gt: 14,
                },
            }, {}); // enabled when 14+, required when enabled

            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual(null); // always enabled
            expect(mergedA.requiredWhen).toEqual({}); // always required

            // Check ordering does not matter
            expect(mergedA).toEqual(mergedB);
        });

        test('one sometimes required and one sometimes required property merge as optional and sometimes required', () => {
            const a = new PropertyFilter(null, {
                age: {
                    $gt: 15,
                },
            }); // required when 15+, optional otherwise
            const b = new PropertyFilter({
                age: {
                    $gt: 14,
                },
            }, {}); // enabled when 14+, required when enabled

            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual(null); // always enabled
            expect(mergedA.requiredWhen).toEqual({
                $or: [
                    {
                        age: {
                            $gt: 15,
                        },
                    },
                    {
                        age: {
                            $gt: 14,
                        },
                    },
                ],
            }); // always required

            // Ordering does matter
            expect(mergedB.enabledWhen).toEqual(null); // always enabled
            expect(mergedB.requiredWhen).toEqual({
                $or: [
                    {
                        age: {
                            $gt: 14,
                        },
                    },
                    {
                        age: {
                            $gt: 15,
                        },
                    },
                ],
            }); // always required
        });

        test('properties that are sometimes required and enabled merge with merging', () => {
            const a = new PropertyFilter({
                enabledA: true,
            }, {
                requiredA: true,
            });
            const b = new PropertyFilter({
                enabledB: true,
            }, {
                requiredB: true,
            });

            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual({
                $or: [
                    { enabledA: true },
                    { enabledB: true },
                ],
            }); // always enabled
            expect(mergedA.requiredWhen).toEqual({
                $or: [
                    {
                        $and: [
                            { enabledA: true },
                            { requiredA: true },
                        ],
                    },
                    {
                        $and: [
                            { enabledB: true },
                            { requiredB: true },
                        ],
                    },
                ],
            });

            // Ordering does matter
            expect(mergedB.enabledWhen).toEqual({
                $or: [
                    { enabledB: true },
                    { enabledA: true },
                ],
            });
            expect(mergedB.requiredWhen).toEqual({
                $or: [
                    {
                        $and: [
                            { enabledB: true },
                            { requiredB: true },
                        ],
                    },
                    {
                        $and: [
                            { enabledA: true },
                            { requiredA: true },
                        ],
                    },
                ],
            });
        });

        test('always optional in combination with enabled filter, merged with sometimes enabled and required', () => {
            const a = new PropertyFilter({
                enabledA: true,
            }, null);
            const b = new PropertyFilter({
                enabledB: true,
            }, {
                requiredB: true,
            });

            const mergedA = a.merge(b);
            const mergedB = b.merge(a);

            expect(mergedA.enabledWhen).toEqual({
                $or: [
                    { enabledA: true },
                    { enabledB: true },
                ],
            });
            expect(mergedA.requiredWhen).toEqual({
                $and: [
                    { enabledB: true },
                    { requiredB: true },
                ],
            });

            // Ordering does matter
            expect(mergedB.enabledWhen).toEqual({
                $or: [
                    { enabledB: true },
                    { enabledA: true },
                ],
            }); // always enabled
            expect(mergedB.requiredWhen).toEqual({
                $and: [
                    { enabledB: true },
                    { requiredB: true },
                ],
            });
        });
    });
});
