import { column, Model } from "@simonbackx/simple-database";
import { SimpleError } from '@simonbackx/simple-errors';
import { PaymentStatus, Version } from '@stamhoofd/structures';
import { IncomingMessage } from 'http';
import https from "https";
import { v4 as uuidv4 } from "uuid";

import { Organization, Payment } from './';

export class PayconiqPayment extends Model {
    static table = "payconiq_payments";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    paymentId: string;

    @column({ type: "string" })
    payconiqId: string;

    async getStatus(organization: Organization): Promise<PaymentStatus> {
        const apiKey = organization.privateMeta.payconiqApiKey
        if (!apiKey) {
            throw new SimpleError({
                code: "",
                message: "Payconiq API key missing to check the status of the payment"
            })
        }

        const response = await PayconiqPayment.request("GET", "/v3/payments/"+this.payconiqId, {}, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')
        if (response.status) {
            switch (response.status) {
                case "AUTHORIZED": return PaymentStatus.Pending;
                case "PENDING": return PaymentStatus.Created;

                case "IDENTIFIED": return PaymentStatus.Pending; // Code has been scanned!

                case "AUTHORIZATION_FAILED": return PaymentStatus.Failed;
                case "EXPIRED": return PaymentStatus.Failed;
                case "FAILED": return PaymentStatus.Failed;
                case "CANCELLED": return PaymentStatus.Failed;

                case "SUCCEEDED": return PaymentStatus.Succeeded;
            }
            return PaymentStatus.Pending // default to pending
        }
        throw new SimpleError({
            code: "",
            message: "Status missing in response"
        })
    }

    async cancel(organization: Organization): Promise<boolean> {
        const apiKey = organization.privateMeta.payconiqApiKey
        if (!apiKey) {
            throw new SimpleError({
                code: "",
                message: "Payconiq API key missing to check the status of the payment"
            })
        }

        // Throws on failure
        try {
            await PayconiqPayment.request("DELETE", "/v3/payments/"+this.payconiqId, {}, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')
            return true;
        } catch (e) {
            console.error('Failed to cancel Payconiq payment', this.id, this.payconiqId, e)
            return false;
        }
    }

    static async createTest(organization: Organization): Promise<boolean> {
        const apiKey = organization.privateMeta.payconiqApiKey
        if (!apiKey) {
            return false
        }

        try {
            const response = await this.request("POST", "/v3/payments", {
                reference: "test-"+(new Date().getTime()), // 36 chars, max length is 35...
                amount: 1,
                currency: "EUR",
                callbackUrl: 'https://'+organization.getApiHost(),
                description: "Key validation test",

            }, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')
            return !!response.paymentId;
        } catch (e) {
            return false;
        }
    }


    static async createPayment(payment: Payment, organization: Organization, description: string, returnUrl?: string, callbackUrl?: string) {
        const apiKey = organization.privateMeta.payconiqApiKey
        if (!apiKey) {
            throw new SimpleError({
                code: "",
                message: "Betaling via Payconiq is tijdelijk onbeschikbaar"
            })
        }

        const response = await this.request("POST", "/v3/payments", {
            reference: payment.id.replace("-", ""), // 36 chars, max length is 35...
            amount: payment.price,
            currency: "EUR",
            callbackUrl: callbackUrl ?? 'https://'+organization.getApiHost()+"/v"+Version+"/payments/"+encodeURIComponent(payment.id)+"?exchange=true",
            returnUrl,
            description
        }, apiKey, organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production')

        const payconiqPayment = new PayconiqPayment()
        payconiqPayment.paymentId = payment.id
        payconiqPayment.payconiqId = response.paymentId

        // Read link (currently we use checkout!)
        let link = response._links.checkout.href as string;

        if (organization.privateMeta.useTestPayments ?? STAMHOOFD.environment != 'production') {
            // For checkout only!
            // We get the wrong link in development mode
            link = link.replace('https://payconiq.com/', 'https://ext.payconiq.com/');
        }

        await payconiqPayment.save();

        return link;
    }

    /**
     * Do a post request on the API.
     */
    private static request(method: string, path: string, data = {}, auth: string | null = null, testMode: boolean): Promise<any> {
        return new Promise((resolve, reject) => {
            const jsonData = JSON.stringify(data);
            const hostname = !testMode ? "api.payconiq.com" : "api.ext.payconiq.com"
            const base = "https://"+hostname

            // Log all communication
            console.log(method+" "+base+path+"\n"+jsonData);
            console.log(jsonData);

            const headers = {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": Buffer.byteLength(jsonData),
            };

            if (auth) {
                headers["Authorization"] = "Bearer "+auth
            }

            const req = https.request(
                {
                    hostname: hostname,
                    path: path,
                    method: method,
                    headers: headers,
                    timeout: 10000,
                },
                (response: IncomingMessage) => {
                    console.log(`statusCode: ${response.statusCode ?? '/'}`);
                    console.log(`HEADERS: ${JSON.stringify(response.headers)}`);

                    const chunks: any[] = [];

                    response.on("data", (chunk) => {
                        chunks.push(chunk);
                    });

                    response.on("end", () => {
                        try {
                            if (!response.statusCode) {
                                reject(new Error("Unexpected order of events"));
                                return;
                            }
                            const body = Buffer.concat(chunks).toString();
                            console.log(body);

                            if (response.statusCode == 204) {
                                resolve(undefined);
                                return;
                            }

                            let json: any;
                            try {
                                json = JSON.parse(body);
                            } catch (error) {
                                console.error(error);
                                
                                // invalid json
                                if (response.statusCode < 200 || response.statusCode >= 300) {
                                    if (body.length == 0) {
                                        console.error(response.statusCode);
                                        reject(new Error("Status " + response.statusCode));
                                        return;
                                    }
                                    console.error(response.statusCode + " " + body);
                                    reject(new Error(body));
                                    return;
                                } else {
                                    // something wrong: throw parse error
                                    reject(error);
                                    return;
                                }
                            }

                            if (response.statusCode < 200 || response.statusCode >= 300) {
                                console.error(body);
                                reject(new Error(response.statusCode + " " + response.statusMessage));
                                return;
                            }

                            resolve(json);
                        } catch (error) {
                            console.error(error);
                            reject(error);
                        }
                    });
                }
            );

            // use its "timeout" event to abort the request
            req.on("timeout", () => {
                req.abort();
            });

            req.on("error", (error) => {
                console.error(error);
                reject(error);
            });

            req.write(jsonData);
            req.end();
        });
    }
}
