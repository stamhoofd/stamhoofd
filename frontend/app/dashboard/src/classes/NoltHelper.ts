import { AutoEncoder, Decoder, field, StringDecoder } from "@simonbackx/simple-encoding"
import { CenteredMessage, Toast } from "@stamhoofd/components"
import { SessionManager } from "@stamhoofd/networking"

class ResponseBody extends AutoEncoder {
    @field({ decoder: StringDecoder })
    jwt: string
}

export async function openNolt(check = false) {
    if (check) {
        if (!document.referrer || (!document.referrer.startsWith("https://"+process.env.NOLT_URL) && !document.referrer.startsWith("https://www.stamhoofd.be") && !document.referrer.startsWith("https://www.stamhoofd.nl"))) {
            if (!await CenteredMessage.confirm("Wil je inloggen in het feedback systeem?", "Ja, open Feedback", "Je logt in op het feedback systeem met dit account: "+SessionManager.currentSession!.user!.email+". Je kan eerst van vereniging veranderen als je met een ander account wilt inloggen.", undefined, false)) {
                return
            }
        }
    }
        // Create token
    const toast = new Toast("Feedback systeem openen...", "spinner").setHide(null).show()
    try {
        const response = await SessionManager.currentSession!.authenticatedServer!.request({
            method: "POST",
            path: "/nolt/create-token",
            decoder: ResponseBody as Decoder<ResponseBody>,
            shouldRetry: false
        })
        window.location.href = "https://"+process.env.NOLT_URL+"/sso/"+encodeURIComponent(response.data.jwt)
    } catch (e) {
        console.error(e)
        Toast.fromError(e).show()
    }
    toast.hide()
}