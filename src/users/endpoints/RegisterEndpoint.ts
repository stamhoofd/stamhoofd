import { Request } from "@/routing/classes/Request";
import { DecodedRequest } from "@/routing/classes/DecodedRequest";
import { Response } from "@/routing/classes/Response";
import { Endpoint } from "@/routing/classes/Endpoint";
import { User } from "../models/User";
import { Token } from "../models/Token";
import { ServerError } from "@/routing/classes/ServerError";
import { Organization } from "@/organizations/models/Organization";
import { RegisterStruct } from "../structs/RegisterStruct";

type Params = {};
type Query = undefined;
type Body = RegisterStruct;
type ResponseBody = undefined;

export class RegisterEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = RegisterStruct;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/register", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.fromHost(request.host);
        const user = await User.register(
            organization,
            request.body.email,
            request.body.password,
            request.body.publicKey
        );
        if (!user) {
            // Todo: Send password recovery email with registration notice
            return new Response(undefined);
        }

        const token = await Token.createToken(user);
        if (!token) {
            throw new ServerError({
                code: "error",
                message: "Could not generate token",
                human: "Er ging iets mis tijdens het registreren.",
            });
        }

        // An email has been send to confirm your email address
        return new Response(undefined);
    }
}
