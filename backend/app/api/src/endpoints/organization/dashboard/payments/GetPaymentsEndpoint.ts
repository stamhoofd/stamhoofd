import { AutoEncoder, Data, DateDecoder, Decoder, EnumDecoder, field, IntegerDecoder, StringDecoder } from "@simonbackx/simple-encoding";
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { Payment, Token, UserWithOrganization } from "@stamhoofd/models";
import { PaymentGeneral, PaymentMethod, PaymentProvider, PaymentStatus, PermissionLevel } from "@stamhoofd/structures";

type Params = Record<string, never>;
type Body = undefined
type ResponseBody = PaymentGeneral[]

export class StringArrayDecoder<T> implements Decoder<T[]> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): T[] {
        const strValue = data.string;

        // Split on comma
        const parts = strValue.split(",");
        return parts
            .map((v, index) => {
                return data.clone({ 
                    data: v, 
                    context: data.context, 
                    field: data.addToCurrentField(index) 
                }).decode(this.decoder)
            });
    }
}

export class StringNullableDecoder<T> implements Decoder<T | null> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): T | null {
        if (data.value === 'null') {
            return null;
        }

        return data.decode(this.decoder);
    }
}


class Query extends AutoEncoder {
    /**
     * Usage in combination with paidSince is special!
     */
    @field({ decoder: StringDecoder, optional: true })
    afterId?: string

    /**
     * Return all payments that were paid after (and including) this date. 
     * Only returns orders **equal** to this date if afterId is not provided or if the id of those payments is also higher.
     */
    @field({ decoder: DateDecoder, optional: true })
    paidSince?: Date

    @field({ decoder: DateDecoder, optional: true })
    paidBefore?: Date

    @field({ decoder: IntegerDecoder, optional: true })
    limit?: number

    @field({ decoder: new StringArrayDecoder(new EnumDecoder(PaymentMethod)), optional: true })
    methods?: PaymentMethod[]

    @field({ decoder: new StringArrayDecoder(new StringNullableDecoder(new EnumDecoder(PaymentProvider))), optional: true })
    providers?: (PaymentProvider|null)[]
}

export class GetPaymentsEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected queryDecoder = Query;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "GET") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/organization/payments", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request);
        const user = token.user

        return new Response(
            (await this.getPayments(user, request.query, PermissionLevel.Read))
        );
    }

    async getPayments(user: UserWithOrganization, query: Query, permissionLevel: PermissionLevel) {
        if (!user.permissions) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang tot deze groep"
            })
        }

        const paidSince = query.paidSince ?? new Date(Date.now() - (24 * 60 * 60 * 1000 * 7 ))
        paidSince.setMilliseconds(0)
        const payments: Payment[] = []

        if (query.afterId) {
            // First return all payments with id > afterId and paidAt == paidSince
            payments.push(...await Payment.where({
                organizationId: user.organizationId, 
                paidAt: {
                    sign: '=', 
                    value: paidSince
                },
                id: {
                    sign: '>',
                    value: query.afterId ?? ""
                },
                method: {
                    sign: 'IN', 
                    value: query.methods ?? [PaymentMethod.Transfer]
                },
                provider: {
                    sign: 'IN', 
                    value: query.providers ?? [null]
                }
            }, {
                limit: query.limit ?? undefined,
                sort: [{
                    column: "id",
                    direction: "ASC"
                }]
            }));
        }

        payments.push(...await Payment.where({
            organizationId: user.organizationId, 
            paidAt: query.paidBefore ? [{
                sign: query.afterId  ? '>' : '>=', 
                value: paidSince
            }, {
                sign: '<=', 
                value: query.paidBefore
            }] : {
                sign: query.afterId  ? '>' : '>=', 
                value: paidSince
            },
            method: {
                sign: 'IN', 
                value: query.methods ?? [PaymentMethod.Transfer]
            },
            provider: {
                sign: 'IN', 
                value: query.providers ?? [null]
            }
        }, {
            limit: query.limit ? (query.limit - payments.length) : undefined,
            sort: [{
                column: "paidAt",
                direction: "ASC"
            }, 
            {
                column: "id",
                direction: "ASC"
            }]
        }));


        if (!query.paidSince && !query.methods && !query.providers) {
            // Default behaviour is to return all not-paid transfer payments that are not yet paid

            payments.push(...
                await Payment.where({
                    organizationId: user.organizationId, 
                    paidAt: null,
                    method: PaymentMethod.Transfer,
                    status: {
                        sign: '!=',
                        value: PaymentStatus.Failed
                    }
                })
            );

            payments.push(...
                await Payment.where({
                    organizationId: user.organizationId, 
                    paidAt: null,
                    updatedAt: {
                        sign: '>', 
                        value: new Date(Date.now() - (24 * 60 * 60 * 1000 * 7 ))
                    },
                    method: PaymentMethod.Transfer,
                    status: PaymentStatus.Failed
                })
            );
        }

        return await Payment.getGeneralStructure(payments, {user, permissionLevel})
    }
}
