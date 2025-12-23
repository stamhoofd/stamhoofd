import { AutoEncoderPatchType, Decoder, PatchableArrayAutoEncoder, PatchableArrayDecoder, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { SimpleError } from '@simonbackx/simple-errors';
import { DocumentTemplate } from '@stamhoofd/models';
import { DocumentTemplatePrivate, PermissionLevel } from '@stamhoofd/structures';

import { SQL } from '@stamhoofd/sql';
import { Context } from '../../../../helpers/Context.js';

type Params = Record<string, never>;
type Query = undefined;
type Body = PatchableArrayAutoEncoder<DocumentTemplatePrivate>;
type ResponseBody = DocumentTemplatePrivate[];

/**
 * One endpoint to create, patch and delete groups. Usefull because on organization setup, we need to create multiple groups at once. Also, sometimes we need to link values and update multiple groups at once
 */

export class PatchDocumentTemplateEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = new PatchableArrayDecoder(DocumentTemplatePrivate as Decoder<DocumentTemplatePrivate>, DocumentTemplatePrivate.patchType() as Decoder<AutoEncoderPatchType<DocumentTemplatePrivate>>, StringDecoder);

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'PATCH') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/organization/document-templates', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOrganizationScope();
        await Context.authenticate();

        if (!await Context.auth.canManageDocuments(organization.id, PermissionLevel.Write)) {
            throw Context.auth.error();
        }

        const updatedTemplates: DocumentTemplatePrivate[] = [];

        for (const { put } of request.body.getPuts()) {
            // Creating new templates
            const template = new DocumentTemplate();
            template.privateSettings = put.privateSettings;
            template.settings = put.settings;
            template.status = put.status;
            template.html = put.html;
            template.updatesEnabled = put.updatesEnabled;
            template.year = put.year;
            template.organizationId = organization.id;

            if (await this.doesYearAlreadyHaveFiscalDocument(template)) {
                throw new SimpleError({
                    code: 'double_fiscal_document',
                    field: 'year',
                    message: 'This year already has a fiscal document',
                    human: $t('Je kan maximaal 1 fiscaal attest per kalenderjaar maken. Er is al een fiscaal attest voor dit jaar.'),
                });
            }

            await template.save();

            // todo: Generate documents (maybe in background)
            template.buildAll().catch(console.error);

            // Return in response
            updatedTemplates.push(template.getPrivateStructure());
        }

        for (const patch of request.body.getPatches()) {
            const template = await DocumentTemplate.getByID(patch.id);
            if (!template || !await Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Full)) {
                throw Context.auth.notFoundOrNoAccess($t(`148bfab7-ca0e-4fac-8a0a-302ca7855fc8`));
            }

            if (patch.privateSettings) {
                const patchType = patch.privateSettings.templateDefinition?.type;

                // only check if type has changed and new type is fiscal
                const shouldCheckIfAlreadyHasFiscalDocument = patchType !== undefined && template.privateSettings.templateDefinition.type !== patchType && patchType === 'fiscal';

                template.privateSettings.patchOrPut(patch.privateSettings);

                if (shouldCheckIfAlreadyHasFiscalDocument && await this.doesYearAlreadyHaveFiscalDocument(template)) {
                    throw new SimpleError({
                        code: 'double_fiscal_document',
                        field: 'year',
                        message: 'This year already has a fiscal document',
                        human: $t('Je kan maximaal 1 fiscaal attest per kalenderjaar maken. Er is al een fiscaal attest voor dit jaar.'),
                    });
                }
            }

            if (patch.settings) {
                template.settings.patchOrPut(patch.settings);
            }

            if (patch.status) {
                template.status = patch.status;
            }

            if (patch.updatesEnabled !== undefined) {
                template.updatesEnabled = patch.updatesEnabled;
            }

            if (patch.html) {
                template.html = patch.html;
            }

            if (patch.year) {
                template.year = patch.year;
            }

            await template.save();

            // Update documents
            await template.buildAll();

            // Return in response
            updatedTemplates.push(template.getPrivateStructure());
        }

        for (const id of request.body.getDeletes()) {
            const template = await DocumentTemplate.getByID(id);
            if (!template || !await Context.auth.canAccessDocumentTemplate(template, PermissionLevel.Full)) {
                throw new SimpleError({
                    code: 'not_found',
                    message: 'Template not found',
                    human: $t(`10aa55e6-5ad6-4ac1-8e7f-3a414e26e22e`),
                });
            }

            await template.delete();
        }

        return new Response(
            updatedTemplates,
        );
    }

    private async doesYearAlreadyHaveFiscalDocument(template: DocumentTemplate) {
        const result = await SQL.select().from(SQL.table(DocumentTemplate.table))
            .where('organizationId', template.organizationId)
            .where('year', template.year)
            .where(SQL.jsonExtract(SQL.column('privateSettings'), '$.value.templateDefinition.type'), 'fiscal')
            .whereNot('id', template.id)
            .limit(1)
            .count();

        return result > 0;
    }
}
