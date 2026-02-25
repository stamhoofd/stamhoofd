import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/models';
import { FilterWrapperMarker, PermissionLevel, StamhoofdFilter, unwrapFilter, WrapperFilter } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context.js';

export async function validateEmailRecipientFilter({ filter, permissionLevel }: { filter: StamhoofdFilter; permissionLevel: PermissionLevel }) {
    // Require presence of a filter
    const requiredFilter: WrapperFilter = {
        emailId: FilterWrapperMarker,
    };

    let unwrapped = unwrapFilter(filter, requiredFilter);
    if (!unwrapped.match) {
        if (typeof filter === 'object'
            && filter !== null
            && filter['$and']
            && Array.isArray(filter['$and'])
            && Object.keys(filter).length >= 1 // does not matter if more than 1, because root is always $and together
            && filter['$and'].length > 0
        ) {
            for (const subFilter of filter['$and']) {
                unwrapped = unwrapFilter(subFilter as StamhoofdFilter, requiredFilter);
                if (unwrapped.match) {
                    // Found!
                    break;
                }
            }
        }
        if (!unwrapped.match) {
            return false;
        }
    }

    const emailIds = typeof unwrapped.markerValue === 'string'
        ? [unwrapped.markerValue]
        : unwrapFilter(unwrapped.markerValue as StamhoofdFilter, {
            $in: FilterWrapperMarker,
        })?.markerValue;

    if (!Array.isArray(emailIds)) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'filter',
            message: 'You must filter on an email id of the email recipients you are trying to access',
            human: $t(`9f352fd4-5e4d-4899-81ce-b69889ebfe9d`),
        });
    }

    if (emailIds.length === 0) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'filter',
            message: 'Filtering on an empty list of email ids is not supported',
        });
    }

    for (const emailId of emailIds) {
        if (typeof emailId !== 'string') {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'filter',
                message: 'Invalid email ID in filter',
            });
        }
    }

    const emails = await Email.getByIDs(...emailIds as string[]);

    console.log('Fetching recipients for emails', emails.map(g => g.subject));

    for (const email of emails) {
        if (!await Context.auth.canAccessEmail(email, permissionLevel)) {
            throw Context.auth.error({
                message: 'You do not have access to this email',
                human: $t(`590a37ed-0f3a-4c66-8e20-08ac00ae761d`),
            });
        }
    }

    return true;
}
