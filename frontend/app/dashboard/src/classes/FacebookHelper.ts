import { Storage, UrlHelper } from "@stamhoofd/networking";
import { FBId } from "@stamhoofd/structures";

export class FacebookHelper {
    static id: FBId | null = null

    static init() {
        const params = UrlHelper.initial.getSearchParams()
        const fbclid = params.get("fbclid")

        if (params.get("_fbp") && params.get("_fbp")!.startsWith("fb.1.")) {
            this.id = FBId.create({
                fbp: params.get("_fbp") ?? "",
                fbc: fbclid ? (this.cleanFbc(fbclid)) : (this.id?.fbc ?? null)
            })
            console.info("Got fbp from url", this.id)
            this.load(false).then(() => this.save()).catch(console.error)
        } else if (fbclid) {
            this.load().then(() => {
                if (this.id) {
                    this.id.fbc = this.cleanFbc(fbclid)

                    console.info("Got fbclid", this.id)
                } else {
                    // Generate random fbp
                    this.id = FBId.create({
                        fbp: this.generate(),
                        fbc: this.cleanFbc(fbclid)
                    })
                    console.info("Generated fbp", this.id)
                }
                return this.save()
            }).catch(console.error)
        } else {
            this.load().then(() => this.save()).catch(console.error)
        }
    }

    static cleanFbc(fbclid: string) {
        if (fbclid.startsWith("fb.1.")) {
            return fbclid
        } else {
            return "fb.1." + Math.floor((new Date()).getTime() / 1000) + "." + fbclid
        }
    }

    static async save() {
        if (this.id) {
            await Storage.keyValue.setItem("_fbp", this.id.fbp)

            if (this.id.fbc) {
                await Storage.keyValue.setItem("_fbc", this.id.fbc)
            }
        }
    }

    static generate() {
        return "fb.1."+Math.floor((new Date()).getTime()/1000)+"."+Math.floor(Math.random()*9999999999)
    }

    static async load(allowOverride = true) {
        const fbp = await Storage.keyValue.getItem("_fbp")
        const fbc = await Storage.keyValue.getItem("_fbc")

        if (fbp && (allowOverride || !this.id)) {
            this.id = FBId.create({
                fbp,
                fbc: this.id?.fbc
            })
        }

        if (!this.id) {
            // Generate
            this.id = FBId.create({
                fbp: this.generate(),
                fbc: fbc
            })
            console.info("Generated fbp", this.id)
        }

        if (fbc && (allowOverride || !this.id.fbc)) {
            this.id.fbc = fbc
        }

        if (fbp || fbc) {
            console.info("Got fbp from storage", this.id)
        }
    }
}