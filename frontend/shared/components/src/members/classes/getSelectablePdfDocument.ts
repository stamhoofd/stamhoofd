import { ContextPermissions } from '@stamhoofd/networking';
import { Group, Organization, Platform } from '@stamhoofd/structures';
import { SelectablePdfDocument } from '../../export/SelectablePdfDocument';
import { SelectablePdfSheet } from '../../export/SelectablePdfSheet';
import { getAllSelectablePdfDataForMemberDetails, getAllSelectablePdfDataForSummary } from './getSelectablePdfData';

export function getSelectablePdfDocument(args: { platform: Platform; organization: Organization | null; groups?: Group[]; auth: ContextPermissions }) {
    return new SelectablePdfDocument({
        sheets: [
            new SelectablePdfSheet({
                id: 'member-details',
                name: $t('Kenmerken per lid'),
                description: $t('Selecteer hier alle kenmerken die je in de samenvatting wilt oplijsten, gegroepeerd per lid.'),
                items: getAllSelectablePdfDataForMemberDetails(args),
            }),
            new SelectablePdfSheet({
                id: 'member-summary',
                name: $t('Leden oplijsten per categorie'),
                description: $t('Je kan ook leden oplijsten per categorie, eventueel met extra opmerkingen erbij (bv. bij aanvinkvakjes met opmerkingen).'),
                items: getAllSelectablePdfDataForSummary(args),
            }),
        ],
    });
}
