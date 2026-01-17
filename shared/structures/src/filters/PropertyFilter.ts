import { cloneObject, Data, Encodeable, EncodeContext, PlainObject } from '@simonbackx/simple-encoding';

import { AuditLogReplacement } from '../AuditLogReplacement.js';
import { Filterable } from '../members/records/RecordCategory.js';
import { StamhoofdFilterDecoder } from './FilteredRequest.js';
import { isEmptyFilter, isEqualFilter, mergeFilters, StamhoofdFilter } from './StamhoofdFilter.js';
import { convertOldPropertyFilter } from './convertOldPropertyFilter.js';

export class PropertyFilter implements Encodeable {
    constructor(enabledWhen: StamhoofdFilter | null, requiredWhen: StamhoofdFilter | null) {
        this.enabledWhen = enabledWhen;
        this.requiredWhen = requiredWhen;
    }

    static createDefault() {
        return new PropertyFilter(null, {});
    }

    /**
     * Enabled when...
     * null = always enabled
     */
    enabledWhen: StamhoofdFilter | null = null;

    /**
     * If enabled, whether it is required
     * null = always skippable
     * empty filter = always required
     */
    requiredWhen: StamhoofdFilter | null = null;

    isEnabled(object: Filterable): boolean {
        if (this.enabledWhen === null) {
            return true;
        }
        return object.doesMatchFilter(this.enabledWhen);
    }

    get isAlwaysEnabledAndRequired() {
        return this.enabledWhen === null && isEmptyFilter(this.requiredWhen) && this.requiredWhen !== null;
    }

    isRequired(object: Filterable): boolean {
        if (this.requiredWhen === null) {
            return false;
        }
        return object.doesMatchFilter(this.requiredWhen);
    }

    encode(context: EncodeContext): PlainObject {
        return {
            enabledWhen: StamhoofdFilterDecoder.encode(this.enabledWhen, context),
            requiredWhen: StamhoofdFilterDecoder.encode(this.requiredWhen, context),
        };
    }

    static decode<T>(data: Data): PropertyFilter {
        if (data.context.version < 251) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            return convertOldPropertyFilter(data.value);
        }

        return new PropertyFilter(
            data.field('enabledWhen').nullable(StamhoofdFilterDecoder),
            data.field('requiredWhen').nullable(StamhoofdFilterDecoder),
        );
    }

    clone() {
        return new PropertyFilter(
            cloneObject(this.enabledWhen),
            cloneObject(this.requiredWhen),
        );
    }

    getDiffValue() {
        if (this.isAlwaysEnabledAndRequired) {
            return AuditLogReplacement.key('alwaysEnabledAndRequired');
        }
        if (this.enabledWhen === null && this.requiredWhen === null) {
            return AuditLogReplacement.key('alwaysEnabledAndOptional');
        }
        if (this.enabledWhen !== null && this.requiredWhen === null) {
            return AuditLogReplacement.key('sometimesEnabledAndOptional');
        }
        if (this.enabledWhen === null && this.requiredWhen !== null) {
            return AuditLogReplacement.key('alwaysEnabledAndSometimesRequired');
        }
        if (this.enabledWhen !== null && isEmptyFilter(this.requiredWhen)) {
            return AuditLogReplacement.key('sometimesEnabledAndRequired');
        }
        return AuditLogReplacement.key('sometimesEnabledAndSometimesRequired');
    }

    merge(other: PropertyFilter) {
        const base = new PropertyFilter(null, {});

        // Merge enabled when
        if (other.enabledWhen === null || this.enabledWhen === null) {
            base.enabledWhen = null;
        }
        else {
            // Merge both filters if different
            if (isEqualFilter(this.enabledWhen, other.enabledWhen)) {
                base.enabledWhen = this.enabledWhen;
            }
            else {
                base.enabledWhen = mergeFilters([
                    this.enabledWhen,
                    other.enabledWhen,
                ], '$or');
            }
        }

        // The rquired filters are always 1:1 linked to the enabled filter of the same property filter. So we need to
        // transform them first to include the enabled when filter
        let thisRequired = this.requiredWhen;
        // Required when the other is enabled and required
        if (this.enabledWhen !== null && !isEmptyFilter(this.enabledWhen)) {
            // Make sure to include the enabled when restriction
            if (this.requiredWhen === null) {
                // Always skipable
                thisRequired = null;
            }
            else {
                if (isEmptyFilter(this.requiredWhen)) {
                    // Simplify without $and
                    thisRequired = this.enabledWhen;
                }
                else {
                    if (isEqualFilter(this.enabledWhen, this.requiredWhen)) {
                        thisRequired = this.requiredWhen;
                    }
                    else {
                        thisRequired = mergeFilters([
                            this.enabledWhen,
                            this.requiredWhen,
                        ], '$and');
                    }
                }
            }
        }

        let otherRequired = other.requiredWhen;
        // Required when the other is enabled and required
        if (other.enabledWhen !== null && !isEmptyFilter(other.enabledWhen)) {
            // Make sure to include the enabled when restriction
            if (other.requiredWhen === null) {
                // Always skipable
                otherRequired = null;
            }
            else {
                if (isEmptyFilter(other.requiredWhen)) {
                    // Simplify without $and
                    otherRequired = other.enabledWhen;
                }
                else {
                    if (isEqualFilter(other.enabledWhen, other.requiredWhen)) {
                        otherRequired = other.requiredWhen;
                    }
                    else {
                        otherRequired = mergeFilters([
                            other.enabledWhen,
                            other.requiredWhen,
                        ], '$and');
                    }
                }
            }
        }

        // Merge required when
        if (thisRequired === null) {
            base.requiredWhen = otherRequired;
        }
        else if (otherRequired === null) {
            base.requiredWhen = thisRequired;
        }
        else if (isEmptyFilter(thisRequired) || isEmptyFilter(otherRequired)) {
            // Always required
            base.requiredWhen = {};
        }
        else {
            // Merge both filters ($or). It is required when any matches

            if (isEqualFilter(thisRequired, otherRequired)) {
                base.requiredWhen = thisRequired;
            }
            else {
                base.requiredWhen = mergeFilters([
                    thisRequired,
                    otherRequired,
                ], '$or');
            }
        }

        return base;
    }
}
