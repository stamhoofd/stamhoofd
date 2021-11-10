import { Request } from '@simonbackx/simple-endpoints';
import { Organization } from '../models/Organization';
import { FBId } from '@stamhoofd/structures';
import axios from 'axios';
import { STInvoice } from '../models/STInvoice';
import crypto from "crypto"
import { User } from '../models/User';

export class FacebookPixel {
    static async send(data: any[]) {
        const TOKEN = STAMHOOFD.FACEBOOK_ACCESS_TOKEN

        if (!TOKEN || !STAMHOOFD.FACEBOOK_PIXEL_ID) {
            return
        }

        const API_VERSION = "v12.0"
        
        const TEST_CODE = STAMHOOFD.FACEBOOK_TEST_EVENT_CODE
        const url = `https://graph.facebook.com/${API_VERSION}/${STAMHOOFD.FACEBOOK_PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`

        console.log("Facebook Pixel Send", data)

        try {
            await axios.post(url, { 
                data, 
                test_event_code: TEST_CODE
            })
        } catch (e) {
            console.error("Invalid Facebook Pixel event")
            console.error(e)
        }
    }

    static hash(value: string) {
        return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex')
    }

    static getOrganizationUserData(organization: Organization, user?: User, request?: Request) {
        return {
            "external_id": this.hash(organization.id),
            "fbp": organization.serverMeta.fb?.fbp,
            "fbc": organization.serverMeta.fb?.fbc ?? undefined,
            "client_ip_address": request ? request.getIP() : undefined,
            "client_user_agent": request?.headers["user-agent"],
            "fn": (user && user.firstName) ? (this.hash(user.firstName)) : undefined,
            "ln": (user && user.lastName) ? (this.hash(user.lastName)) : undefined,
            "em": (user && user.email) ? (this.hash(user.email)) : undefined,

            "country": this.hash(organization.address.country),
            "ct": this.hash(organization.address.city),
            "zp": this.hash(organization.address.postalCode),
        }
    }

    static getUserData(fb: FBId, request?: Request) {
        return {
            "fbp": fb.fbp,
            "fbc": fb.fbc ?? undefined,
            "client_ip_address": request ? request.getIP() : undefined,
            "client_user_agent": request?.headers["user-agent"],
            // SHA256 if needed
        }
    }

    static async trackSignUp(organization: Organization, user: User, request: Request) {
        const data = {
            "event_name": "CompleteRegistration",
            "event_time": Math.floor(new Date().getTime()/1000),
            "user_data": this.getOrganizationUserData(organization, user, request),
            "event_source_url": "https://www.stamhoofd.app/aansluiten",
            "action_source": "website" // system_generated if automatic!
        }
        await this.send([data])
    }

    static async trackOpenSignUp(fb: FBId, request: Request) {
        const data = {
            "event_name": "Lead",
            "event_time": Math.floor(new Date().getTime()/1000),
            "user_data": this.getUserData(fb, request),
            "event_source_url": "https://www.stamhoofd.app/aansluiten",
            "action_source": "website" // system_generated if automatic!
        }
        await this.send([data])
    }

    static async trackPurchase(organization: Organization, invoice: STInvoice) {
        const data = {
            "event_name": "Purchase",
            "event_time": Math.floor(new Date().getTime()/1000),
            "user_data": {
                ...this.getOrganizationUserData(organization),
                "client_ip_address": invoice.meta.ipAddress,
                "client_user_agent": invoice.meta.userAgent,
            },
            "event_source_url": "https://www.stamhoofd.app/settings",
            "action_source": "website", // system_generated if automatic!
            "custom_data": {
                "currency": "EUR",
                "value": invoice.meta.priceWithoutVAT / 100,
                "contents": invoice.meta.items.map(i => {
                    return {
                        id: i.package?.meta.type ?? "Unknown",
                        quantity: i.amount
                    }
                }),
                "content_type": "product",
            }
        }
        await this.send([data])
    }

    static async trackFreeTrial(organization: Organization, invoice: STInvoice) {
        const data = {
            "event_name": "StartTrial",
            "event_time": Math.floor(new Date().getTime()/1000),
            "user_data": {
                ...this.getOrganizationUserData(organization),
                "client_ip_address": invoice.meta.ipAddress,
                "client_user_agent": invoice.meta.userAgent,
            },
            "event_source_url": "https://www.stamhoofd.app/settings",
            "action_source": "website", 
            "custom_data": {
                "currency": "EUR",
                "predicted_ltv": 59,
            }
        }
        await this.send([data])
    }
    
    static async trackProForma(organization: Organization, user: User, invoice: STInvoice) {
        const data = {
            "event_name": "InitiateCheckout",
            "event_time": Math.floor(new Date().getTime()/1000),
            "user_data": {
                ...this.getOrganizationUserData(organization, user),
                "client_ip_address": invoice.meta.ipAddress,
                "client_user_agent": invoice.meta.userAgent,
            },
            "event_source_url": "https://www.stamhoofd.app/settings",
            "action_source": "website", // system_generated if automatic!
            "custom_data": {
                "currency": "EUR",
                "value": invoice.meta.priceWithoutVAT / 100,
                "contents": invoice.meta.items.map(i => {
                    return {
                        id: i.package?.meta.type ?? "Unknown",
                        quantity: i.amount
                    }
                }),
                "content_type": "product",
            }
        }
        await this.send([data])
    }
}