import { Request } from "@/routing/classes/Request";
import { DecodedRequest } from "@/routing/classes/DecodedRequest";
import { Response } from "@/routing/classes/Response";
import { Endpoint } from "@/routing/classes/Endpoint";
import { TokenStruct } from "../structs/TokenStruct";
import { PasswordGrantStruct } from "../structs/PasswordGrantStruct";
import { User } from "../models/User";
import { ClientError } from "@/routing/classes/ClientError";
import { Token } from "../models/Token";
import { ServerError } from "@/routing/classes/ServerError";
import { Organization } from "@/organizations/models/Organization";

type Params = {};
type Query = undefined;
type Body = PasswordGrantStruct;
type ResponseBody = TokenStruct;

export class CreateTokenEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected bodyDecoder = PasswordGrantStruct;

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "POST") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/oauth/token", {});

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const organization = await Organization.fromHost(request.host);
        const user = await User.login(organization, request.body.username, request.body.password);
        if (!user) {
            throw new ClientError({
                code: "invalid_data",
                message: "Invalid username or password",
                human: "Het ingevoerde e-mailadres of wachtwoord is onjuist.",
            });
        }

        const token = await Token.createToken(user, "device id", "device name");
        if (!token) {
            throw new ServerError({
                code: "error",
                message: "Could not generate token",
                human: "Er ging iets mis tijdens het inloggen.",
            });
        }

        const st = new TokenStruct(token);
        return new Response(st);
    }
}
