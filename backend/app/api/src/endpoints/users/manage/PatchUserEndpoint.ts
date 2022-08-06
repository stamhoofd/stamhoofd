import { AutoEncoderPatchType, Decoder } from '@simonbackx/simple-encoding';
import { DecodedRequest, Endpoint, Request, Response } from "@simonbackx/simple-endpoints";
import { SimpleError } from "@simonbackx/simple-errors";
import { EmailVerificationCode, PasswordToken, Token, User } from '@stamhoofd/models';
import { NewUser, Permissions, SignupResponse, User as UserStruct } from "@stamhoofd/structures";

type Params = { id: string };
type Query = undefined;
type Body = AutoEncoderPatchType<NewUser>
type ResponseBody = UserStruct

export class PatchUserEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    bodyDecoder = NewUser.patchType() as Decoder<AutoEncoderPatchType<NewUser>>

    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "PATCH") {
            return [false];
        }

        const params = Endpoint.parseParameters(request.url, "/user/@id", { id: String });

        if (params) {
            return [true, params as Params];
        }
        return [false];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        const token = await Token.authenticate(request, {allowWithoutAccount: true});
        const user = token.user

        if (((!user.permissions || !user.permissions.hasFullAccess()) && user.id != request.body.id) || request.params.id != request.body.id) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te wijzigen"
            })
        }

        const editUser = request.body.id === user.id ? user : await User.getByID(request.body.id)
        if (editUser?.organizationId !== user.organizationId) {
            throw new SimpleError({
                code: "permission_denied",
                message: "Je hebt geen toegang om deze gebruiker te wijzigen"
            })
        }

        editUser.firstName = request.body.firstName ?? editUser.firstName
        editUser.lastName = request.body.lastName ?? editUser.lastName

        if (request.body.permissions !== undefined) {
            if (!user.permissions || !user.permissions.hasFullAccess()) {
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen rechten om de rechten van deze gebruiker te wijzigen"
                })
            }

            if (request.body.permissions && request.body.permissions.isPatch()) {
                editUser.permissions = editUser.permissions ? editUser.permissions.patch(request.body.permissions) : Permissions.create({}).patch(request.body.permissions)
            } else {
                editUser.permissions = request.body.permissions
            }
        }

        if (editUser.id == user.id && request.body.password) {
            // password changes
            await editUser.changePassword(request.body.password)
            await PasswordToken.clearFor(editUser.id)
        }

        await editUser.save();

        if (request.body.email && request.body.email !== editUser.email) {
            const fullUser = await User.getFull(user.id)
            if (!fullUser) {
                console.error("Unexpected user not found while fetching full user")
                throw new SimpleError({
                    code: "permission_denied",
                    message: "Je hebt geen toegang om deze gebruiker te wijzigen"
                })
            }

            // Create an validation code
            // We always need the code, to return it. Also on password recovery -> may not be visible to the client whether the user exists or not
            const code = await EmailVerificationCode.createFor(editUser, request.body.email)
            code.send(editUser.setRelation(User.organization, user.organization), request.i18n, editUser.id === user.id)

            throw new SimpleError({
                code: "verify_email",
                message: "Your email address needs verification",
                human: editUser.id === user.id ? "Verifieer jouw nieuwe e-mailadres via de link in de e-mail, daarna passen we het automatisch aan." : "Er is een verificatie e-mail verstuurd naar "+request.body.email+" om het e-mailadres te verifiëren. Zodra dat is gebeurd, wordt het e-mailadres gewijzigd.",
                meta: SignupResponse.create({
                    token: code.token,
                }).encode({ version: request.request.getVersion() }),
                statusCode: 403
            });
        }

        return new Response(UserStruct.create({...editUser, hasAccount: editUser.hasAccount()}));      
    }
}
