import type { Document, DocumentTemplatePrivate } from '@stamhoofd/structures';
import { FiscalDocumentYearHelper } from '@stamhoofd/utility';

import { fiscal } from './definitions/fiscal';

/**
 * From income year 2026 Belcotax identifies a fiscal document by its key, so documents no longer get a sequential number.
 */
export function hasDocumentNumbers(template: DocumentTemplatePrivate) {
    return template.privateSettings.templateDefinition.type !== fiscal.type || new FiscalDocumentYearHelper().isXmlExportSupported(template.year);
}

/**
 * The key of the fiche in the Belcotax file, as built by BelcotaxJsonlService.ficheKey in the backend.
 */
export function getBelcotaxKey(template: DocumentTemplatePrivate, document: Document) {
    return `STA-${template.year}-${document.id}`;
}
