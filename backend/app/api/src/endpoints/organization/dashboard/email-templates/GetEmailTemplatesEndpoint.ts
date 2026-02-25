import { AutoEncoder, Decoder, EnumDecoder, field, StringDecoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from '@simonbackx/simple-endpoints';
import { EmailTemplate } from '@stamhoofd/models';
import { EmailTemplate as EmailTemplateStruct, EmailTemplateType } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { StringArrayDecoder } from '../../../../decoders/StringArrayDecoder.js';
import { StringNullableDecoder } from '../../../../decoders/StringNullableDecoder.js';
import { Context } from '../../../../helpers/Context.js';

type Params = Record<string, never>;
type Body = undefined;

class Query extends AutoEncoder {
    @field({ decoder: new StringNullableDecoder(StringDecoder), optional: true, nullable: true })
    webshopId: string | null = null;

    @field({ decoder: new StringNullableDecoder(new StringArrayDecoder(StringDecoder)), optional: true, nullable: true })
    groupIds: string[] | null = null;

    @field({ decoder: new StringNullableDecoder(new StringArrayDecoder(new EnumDecoder(EmailTemplateType))), optional: true, nullable: true })
    types: EmailTemplateType[] | null = null;
}

type ResponseBody = EmailTemplateStruct[];

export class GetEmailTemplatesEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = Query as Decoder<Query>;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method !== 'GET') {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, '/email-templates', {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Context.setOptionalOrganizationScope();
        await Context.authenticate();

        if (organization) {
            if (!await Context.auth.canReadEmailTemplates(organization.id)) {
                throw Context.auth.error();
            }
        }

        if (request.query.types?.length === 0) {
            throw new SimpleError({
                code: 'empty_types',
                message: 'Types cannot be empty',
            });
        }

        const types = (request.query.types ?? [...Object.values(EmailTemplateType)]).filter((type) => {
            if (!organization) {
                return EmailTemplateStruct.allowPlatformLevel(type);
            }
            return EmailTemplateStruct.allowOrganizationLevel(type);
        });

        if (types.length === 0) {
            throw new SimpleError({
                code: 'empty_types',
                message: 'Types after filtering allowed types is empty',
            });
        }

        const templates = organization
            ? (
                    await EmailTemplate.where({
                        organizationId: organization.id,
                        webshopId: request.query.webshopId ?? null,
                        groupId: request.query.groupIds ? { sign: 'IN', value: request.query.groupIds } : null,
                        type: { sign: 'IN', value: types } })
                )
            : (
                // Required for event emails when logged in as the platform admin
                    (request.query.webshopId || request.query.groupIds)
                        ? await EmailTemplate.where({
                            webshopId: request.query.webshopId ?? null,
                            groupId: request.query.groupIds ? { sign: 'IN', value: request.query.groupIds } : null,
                            type: { sign: 'IN', value: types },
                        })
                        : []
                );

        const defaultTemplateTypes = organization ? types.filter(type => !EmailTemplateStruct.isSavedEmail(type)) : types;
        const defaultTemplates = defaultTemplateTypes.length === 0
            ? []
            : (await EmailTemplate.where({
                    organizationId: null,
                    type: {
                        sign: 'IN',
                        value: defaultTemplateTypes,
                    },
                }));

        if (organization && (request.query.webshopId || request.query.groupIds)) {
            const orgDefaults = (await EmailTemplate.where({
                organizationId: organization.id,
                webshopId: null,
                groupId: null,
                type: {
                    sign: 'IN',
                    value: defaultTemplateTypes,
                },
            }));

            defaultTemplates.unshift(...orgDefaults);
        }

        const allTemplates: EmailTemplate[] = [];

        for (const template of templates.concat(defaultTemplates)) {
            if (await Context.auth.canAccessEmailTemplate(template)) {
                allTemplates.push(template);
            }
        }

        return new Response(allTemplates.map(template => EmailTemplateStruct.create(template)));
    }
}
