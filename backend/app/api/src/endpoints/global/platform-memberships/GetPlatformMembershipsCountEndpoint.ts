import type { Decoder } from '@simonbackx/simple-encoding';
import type { DecodedRequest, Request } from '@simonbackx/simple-endpoints';
import { Endpoint, Response } from '@simonbackx/simple-endpoints';
import { CountFilteredRequest, CountResponse, PermissionLevel } from '@stamhoofd/structures';
import { Context } from '../../../helpers/Context.js';
import { GetPlatformMembershipsEndpoint } from './GetPlatformMembershipsEndpoint.js';

type Params = Record<string, never>;
type Query = CountFilteredRequest;
type Body = undefined;
type ResponseBody = CountResponse

export class GetPlatformMembershipsCountEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    queryDecoder = CountFilteredRequest as Decoder<CountFilteredRequest>;

    protected doesMatch(request: Request): [true, Params] | [false] {
           if (request.method !== 'GET') {
               return [false];
           }
   
           const params = Endpoint.parseParameters(request.url, '/platform-memberships/count', {});
   
           if (params) {
               return [true, params as Params];
           }
           return [false];
       }
   
       async handle(request: DecodedRequest<Params, Query, Body>) {
           await Context.setOptionalOrganizationScope();
           await Context.authenticate();

            // todo: check if access to finance?
            if (!Context.auth.canAccessAllPlatformMembers(PermissionLevel.Read)) {
                throw Context.auth.error();
            }
                  
           const query = await GetPlatformMembershipsEndpoint.buildQuery(request.query);
   
           const count = await query
               .count();
   
           return new Response(
               CountResponse.create({
                   count,
               }),
           );
       }
}
