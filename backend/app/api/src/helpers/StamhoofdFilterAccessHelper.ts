import { SimpleError } from '@simonbackx/simple-errors';
import type { StamhoofdCompareValue, StamhoofdFilter } from '@stamhoofd/structures';
import { FilterWrapperMarker, getMagicRelationValue, isMagicFilter, isMagicRelationFilter, unwrapFilter } from '@stamhoofd/structures';

export class StamhoofdFilterAccessHelper {
    static getGroupIdsFromFilter(filter: StamhoofdFilter): StamhoofdFilter<StamhoofdCompareValue>[] {
        let rawGroupIds: StamhoofdFilter<StamhoofdCompareValue>[] | null = null;
    
        if (typeof filter === 'string' || isMagicFilter(filter)) {
            rawGroupIds = [filter];
        }
        else {
            const { markerValue } = unwrapFilter(filter, {
                $in: FilterWrapperMarker,
            });
    
            if (!Array.isArray(markerValue)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'filter',
                    message: 'You must filter on a group of the organization you are trying to access',
                    human: $t(`%1HG`),
                });
            }

            if (markerValue.length === 0) {
                throw new SimpleError({
                    code: 'invalid_field',
                    field: 'filter',
                    message: 'Filtering on an empty list of groups is not supported',
                });
            }
    
            rawGroupIds = markerValue;
        }
    
        return rawGroupIds.map(raw => {
            if (typeof raw === 'string') {
                return raw;
            }
    
            if (isMagicRelationFilter(raw)) {
                return getMagicRelationValue(raw);
            }
    
            throw new SimpleError({
                code: 'invalid_field',
                field: 'filter',
                message: 'Invalid group ID in filter',
            });
        });
    }
}
