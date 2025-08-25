import { SimpleError } from '@simonbackx/simple-errors';
import { Email } from '@stamhoofd/models';
import { FilterWrapperMarker, PermissionLevel, StamhoofdFilter, unwrapFilter, WrapperFilter } from '@stamhoofd/structures';
import { Context } from '../../../../helpers/Context';

export async function validateEmailRecipientFilter({ filter, permissionLevel }: { filter: StamhoofdFilter; permissionLevel: PermissionLevel }) {
    // Require presence of a filter
    const requiredFilter: WrapperFilter = {
        emailId: FilterWrapperMarker,
    };

    const unwrapped = unwrapFilter(filter, requiredFilter);
    if (!unwrapped.match) {
        return false;
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
            human: $t(`Je hebt niet voldoende toegangsrechten om alle email ontvangers te bekijken.`),
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
                human: $t(`Je hebt geen toegangsrechten tot de ontvangers van deze email`),
            });
        }
    }

    return true;
}
