import { ContextPermissions } from '@stamhoofd/networking';
import { Group, Organization, Platform, PlatformMember } from '@stamhoofd/structures';
import { PdfDocument, PdfDocuments } from '../../export/PdfDocuments';
import { getAllSelectablePdfDataForMemberDetails } from './getSelectablePdfData';

export function getPdfDocuments(args: { platform: Platform; organization: Organization | null; groups?: Group[]; auth: ContextPermissions }) {
    const sorter = PlatformMember.sorterByName('ASC');

    return new PdfDocuments({
        documents: [
            new PdfDocument({
                id: 'members',
                name: $t('Kenmerken per lid'),
                description: $t('Selecteer hier alle kenmerken die je in de samenvatting wilt oplijsten, gegroepeerd per lid.'),
                items: getAllSelectablePdfDataForMemberDetails(args),
                getItemName: item => item.patchedMember.details.name,
                columnCount: 2,
                sorter,
            }),
            new PdfDocument({
                id: 'members',
                name: $t('Leden oplijsten per categorie'),
                description: $t('Je kan ook leden oplijsten per categorie, eventueel met extra opmerkingen erbij (bv. bij aanvinkvakjes met opmerkingen).'),
                items: [],
                // todo
                getItemName: _item => 'todo',
                columnCount: 1,
                sorter,
            }),
        ],
    });
}
