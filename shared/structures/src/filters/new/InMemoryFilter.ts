import { PlainObject } from "@simonbackx/simple-encoding";
import { StringCompare } from "@stamhoofd/utility";

type InMemoryFilterRunner = (object: any) => boolean;

type InMemoryFilterCompiler = (filter: PlainObject, filters: InMemoryFilterDefinitions) => InMemoryFilterRunner|null;
type InMemoryFilterDefinitions = Record<string, InMemoryFilterCompiler>


function andInMemoryFilterCompiler(filter: PlainObject, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const runners = compileInMemoryFilter(filter, filters);
    return (object) => {
        for (const runner of runners) {
            if (!runner(object)) {
                return false;
            }
        }
        return true;
    };
}

function orInMemoryFilterCompiler(filter: PlainObject, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const runners = compileInMemoryFilter(filter, filters)
    return (object) => {
        for (const runner of runners) {
            if (runner(object)) {
                return true;
            }
        }
        return false;
    };
}

function notInMemoryFilterCompiler(filter: PlainObject, filters: InMemoryFilterDefinitions): InMemoryFilterRunner {
    const andRunner = andInMemoryFilterCompiler(filter, filters);
    return (object) => {
        return !andRunner(object);
    };
}

function objectPathValue(object: any, path: string[]) {
    if (path.length === 0)  {
        return object;
    }

    const nextSearched = path[0];
    if (nextSearched in object) {
        return objectPathValue(object[nextSearched], path.slice(1))
    }
}

function normalizeValue(val: any) {
    if (val instanceof Date) {
        return val.getTime()
    }

    if (typeof val === 'string') {
        return val.toLocaleLowerCase()
    }

    return val;
}

function createInMemoryFilterCompiler(path: string): InMemoryFilterCompiler {
    const splitted = path.split('.');

    return (filter: PlainObject, filters: InMemoryFilterDefinitions) => {
        if (typeof filter === 'string' || typeof filter === 'number' || typeof filter === 'boolean' || filter === null || filter === undefined) {
            filter = {
                $eq: filter
            }
        }

        if (Array.isArray(filter)) {
            throw new Error('Unexpected array in filter')
        }

        const f = filter;

        return (object) => {
            const val = normalizeValue(objectPathValue(object, splitted));
            
            if ("$eq" in f) {
                return val === normalizeValue(f.$eq);
            }

            if ("$neq" in f) {
                return val !== normalizeValue(f.$neq);
            }

            if ("$gt" in f) {
                return val > normalizeValue(f.$gt);
            }

            if ("$lt" in f) {
                return val < normalizeValue(f.$lt);
            }

            if ("$contains" in f) {
                if (typeof val !== 'string' || typeof f.$contains !== 'string') {
                    return false;
                }
                return StringCompare.contains(val, f.$contains)
            }

            throw new Error('Invalid filter')
        };
    }
}

export const baseInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    '$and': andInMemoryFilterCompiler,
    '$or': orInMemoryFilterCompiler,
    '$not': notInMemoryFilterCompiler,
}

export const memberInMemoryFilterCompilers: InMemoryFilterDefinitions = {
    ...baseInMemoryFilterCompilers,
    id: createInMemoryFilterCompiler('id'),
    name: createInMemoryFilterCompiler('name'),
    birthDay: createInMemoryFilterCompiler('birthDay'),
}

function compileInMemoryFilter(filter: PlainObject, definitions: InMemoryFilterDefinitions): InMemoryFilterRunner[] {
    if (filter === undefined) {
        return [];
    }

    const runners: InMemoryFilterRunner[] = []

    for (const f of (Array.isArray(filter) ? filter : [filter])) {
        if (!f) {
            continue;
        }
        for (const key of Object.keys(f)) {
            const filter = definitions[key];
            if (!filter) {
                throw new Error('Unsupported filter ' + key)
            }

            const s = filter(f[key] as PlainObject, definitions)
            if (s === undefined || s === null) {
                throw new Error('Unsupported filter value for ' + key)
            }
            runners.push(s);
        }
    }

    return runners
}

export const compileToInMemoryFilter = andInMemoryFilterCompiler
