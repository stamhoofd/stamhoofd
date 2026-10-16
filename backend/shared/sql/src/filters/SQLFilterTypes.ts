import type { FilterCompiler, FilterDefinitions, RequiredFilterCompiler, StamhoofdFilter } from '@stamhoofd/structures';
import type { SQLExpression } from '../SQLExpression.js';
import type { SQLWhere } from '../SQLWhere.js';

export type SQLSyncFilterRunner = (column: SQLCurrentColumn) => SQLWhere;
export type SQLFilterRunner = (column: SQLCurrentColumn) => Promise<SQLWhere> | SQLWhere;
export type SQLFilterCompiler = FilterCompiler<SQLFilterRunner>;
export type SQLRequiredFilterCompiler = RequiredFilterCompiler<SQLFilterRunner>;
export type SQLFilterDefinitions = FilterDefinitions<SQLFilterRunner>;

export enum SQLValueType {
    /** At the root of a select */
    Table = 'Table',

    /** Column with type string */
    String = 'String',

    /** MySQL Datetime */
    Datetime = 'Datetime',

    /**
     * Column with type number, containing a date as a unix timestamp in milliseconds.
     * Compare values are Dates, which are converted to milliseconds before comparing.
     */
    DateNumber = 'DateNumber',

    /** Column with type number */
    Number = 'Number',

    /** Column with type boolean, meaning 1 or 0 */
    Boolean = 'Boolean',

    /** True or false in JSON */
    JSONBoolean = 'JSONBoolean',
    JSONString = 'JSONString',
    JSONNumber = 'JSONNumber',

    /**
     * A date in JSON. Dates are encoded as a unix timestamp in milliseconds (see DateDecoder), so this is
     * stored as a JSON number. Normalizes to DateNumber.
     */
    JSONDate = 'JSONDate',

    /**
     * Either boolean, string, number or null (if nullable). Only use this if you cannot determine the type at compile time.
     */
    JSONScalar = 'JSONScalar',

    /** [...] */
    JSONArray = 'JSONArray',

    /** {...} */
    JSONObject = 'JSONObject',
}

export type SQLCurrentColumn = {
    expression: SQLExpression;

    /**
     * MySQL nullable. Please fill this in correctly! If a value can be null, can not exist (=mysql null), or can be JSONNull, set this to true.
     *
     * Mainly > and < operators will make sure the behaviour is consistent with MySQL sorting (normally comparing with null will always return false in MySQL)
     */
    nullable?: boolean;

    /**
     * JSON nullable
     */

    /**
     * Type of this column, use to normalize values received from filters
     */
    type: SQLValueType;
    checkPermission?: (filter: StamhoofdFilter) => Promise<void>;
};
