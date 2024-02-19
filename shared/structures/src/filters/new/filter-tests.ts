import { MemberWithRegistrations } from "../members/MemberWithRegistrations"
import { NumberFilterMode } from "./NumberFilter";

// JSON encoded form
[
    {
        'name': {
            '$eq': 'Simon'
        },
        '$and': [
            {
                'name': {
                    '$eq': 'Simon'
                },
                'registrations': [
                    {
                        'id': ''
                    }
                ]
            },
            {
                'registrations': [
                    {
                        '$or': [
                            {
                                'id': 'x'
                            }, {
                                'id': 'y'
                            },
                            {
                                '$and': [
                                    {
                                        'name': 'kapoenen',
                                    }, {
                                        'id': {
                                            '$in': ['x', 'y']
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                'registrations': [
                    {
                        'id': ''
                    }
                ]
            }
        ]
    }
]


function columnFilter(key: string) {
    return function (data: JSONFilter) {
        if (typeof data !== 'object') {
            return null;
        }
        if ('$eq' in data) {
            return `${key} = ${unknownTo(data.$eq)}`;
        }

        return null;
    };
}

type JSONFilter = Record<string, unknown>|Record<string, JSONFilter>[];
type SQLFilter = (data: JSONFilter, filters: SQLFilterDefinitions) => string|null;
type SQLFilterDefinitions = Record<string, SQLFilter>

function unknownTo(u: unknown): string|number {
    if (typeof u === 'string') {
        return u;
    }
    if (typeof u === 'number') {
        return u;
    }
    throw new Error('Invalid type')
}

function jsonColumnFilter(column: string, path: string) {
    return function (data: JSONFilter, filters: SQLFilterDefinitions) {
        if (typeof data !== 'object') {
            return null;
        }
        if ('$eq' in data) {
            return `${column}->>${path} = ${unknownTo(data.$eq)}`;
        }
        return null;
    };
}

function andSQLFilter(data: JSONFilter, filters: SQLFilterDefinitions) {
    return filterToSQL(data, filters).join(' AND ');
}

function orSQLFilter(data: JSONFilter, filters: SQLFilterDefinitions) {
    return filterToSQL(data, filters).join(' OR ');
}

const registrationFilters = {
    'group': columnFilter('groupId'),
}

function registrationsFilter(registrationFilterDefinitions: SQLFilterDefinitions) {
    return function (data: JSONFilter) {
        const parsedSubqueryWhere = andSQLFilter(data, registrationFilterDefinitions);
        return `EXISTS (SELECT * FROM registrations where registrations.memberId = members.id AND ${parsedSubqueryWhere})`
    };
}

function recordAnswersFilter(column: string, path: string) {
    return function (data: JSONFilter) {
        return `${column}->>${path + '.' + data.key} = ${unknownTo(data.$eq)}`;
    };
}

const filters: SQLFilterDefinitions = {
    '$and': andSQLFilter,
    '$or': orSQLFilter,
    //'$or': '',
    //'$not': '',

    'id': columnFilter('id'),
    'name': columnFilter('name'),
    'firstName': jsonColumnFilter('details', '$.value.firstName'),
    'birthDay': jsonColumnFilter('details', '$.value.birthDay'),
    'customProperty': jsonColumnFilter('details', '$.value.recordAnswers.IDOFCUSTOM.value'),
    
    'registrations': registrationsFilter(registrationFilters),
    // Mimic record answers as some sort of relation value
    'recordAnswers.*': columnFilter('todo')
}

function filterToSQL(json: JSONFilter, definitions: SQLFilterDefinitions): string[] {
    const sql: string[] = []
    for (const f of (Array.isArray(json) ? json : [json])) {
        for (const key of Object.keys(f)) {
            const filter = definitions[key];
            if (!filter) {
                throw new Error('Unsupported filter ' + key)
            }

            const s = filter(f[key] as JSONFilter, definitions)
            if (!s) {
                throw new Error('Unsupported filter value for ' + key)
            }
            sql.push(s)
        }
    }

    return sql
}

type UIFilter = {
    key: string
}

type NumberFilter = UIFilter & {
    start: number | null
    end: number | null
    mode: NumberFilterMode
}


// Wat als UIFilters -> Filters enkel éénrichting is en nooit in de andere richting werkt? -> veel eenvoudiger, toch?
// const memberUIFilters = {
//     'age': numberUIFilter({
//         name: 'Leeftijd',
//         description: 'Filter op de leeftijd van een lid.',
//         toFilter(f: NumberFilter) {
//             return {
//                 'birthDay': {
//                     '$gt': '2020-01-01',
//                     '$lt': '2020-01-01'
//                 }
//             }
//         }
//     })
// }

// JSON encoded form
// {
//     filter: '$and',
//     filters: [
//         {
//             filter: 'age',
//             start: 18,
//             end: null,
//             mode: '>'
//         },
//         {
//             filter: 'age',
//             start: 18,
//             end: null,
//             mode: '>'
//         },
//         {
//             filter: 'name',
//             startsWith: 'Si'
//         },
//         {
//             filter: 'registrations',
//             description: 'Ingeschreven voor kapoenen',
//             groupIds: ['12341234']
//         },
//         {
//             filter: '$or',
//             filters: [
//                 {
//                     filter: 'age',
//                     start: 18,
//                     end: null,
//                     mode: '>'
//                 },
//                 {
//                     filter: 'age',
//                     start: 18,
//                     end: null,
//                     mode: '>'
//                 }
//             ]
//         }
//     ]
// }
// 