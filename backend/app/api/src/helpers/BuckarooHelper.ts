import { SimpleError } from '@simonbackx/simple-errors';
import { BuckarooPayment, Payment } from '@stamhoofd/models';
import { PaymentMethod, PaymentStatus } from '@stamhoofd/structures';
import axios from 'axios';
import crypto from 'crypto';

export class BuckarooHelper {
    key: string;
    secret: string;
    testMode: boolean;

    constructor(key: string, secret: string, testMode: boolean) {
        this.key = key;
        this.secret = secret;
        this.testMode = testMode;
    }

    getEncodedContent(content: string) {
        if (content) {
            return crypto.createHash('md5').update(content).digest("base64")
        }
 
        return content;
    }

    calculateHMAC(method: string, url: string, content: string): string {
        method = method.toUpperCase()

        // Remove protocol from url
        url = url.replace(/^https?:\/\//, '')

        // Uri encode
        url = encodeURIComponent(url)

        // To lowercase (should be last)
        url = url.toLowerCase()

        const timestamp = Math.floor(Date.now() / 1000)

        // Nonce: A random sequence of characters, this should differ from for each request.
        const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)

        const encodedContent = this.getEncodedContent(content)
        const rawData = this.key + method + url + timestamp + nonce + encodedContent;

        // The HMAC SHA256 of rawData using secret
        const hash = crypto.createHmac('sha256', this.secret).update(rawData).digest('base64');

        return "hmac " + this.key + ":" + hash + ":" + nonce + ":" + timestamp;
    }

    async request(method: "GET" | "POST", uri: string, content: any) {

        const json = content ? JSON.stringify(content) : "";
        // Finally, if you want to perform live transactions, sent the API requests to https://checkout.buckaroo.nl/json/Transaction
        const url = (!this.testMode ? "https://checkout.buckaroo.nl" : "https://testcheckout.buckaroo.nl")+uri;

        console.log("[BUCKAROO REQUEST] ", method, url, content ? "\n [BUCKAROO REQUEST] " : undefined, json)

        const response = await axios.request({
            method,
            url,
            headers: {
                'Content-Type': json.length > 0 ? 'application/json' : "text/plain",
                'Authorization': this.calculateHMAC(method, url, json)
            },
            data: json
            
        })
        console.log("[BUCKAROO RESPONSE] ", method, url, "\n[BUCKAROO RESPONSE]", JSON.stringify(response.data))
        return response.data
    }

    async createTest(): Promise<boolean> {
        const service = {
                "Name": "bancontactmrcash",
                "Action": "Pay",
                "Parameters": [
                    {
                        "Name": "savetoken",
                        "Value": "false"
                    }
                ]
            };
        const data = {
            "Currency": "EUR",
            "AmountDebit": "0.01",
            "Invoice": "TESTPAYMENT-"+(new Date().getTime())+"-"+Math.round(Math.random()*100000),
            "ClientIP": {
                "Type": 0, // 0 = ipv4, 1 = ipv6
                "Address": "0.0.0.0"
            },
            "Services": {
                "ServiceList": [
                    service
                ]
            },
            "ContinueOnIncomplete": "1", // iDEAL
            "Description": "Test payment",
            "PushURL": "",
            "PushURLFailure": "",
            "ReturnURL": "https://stamhoofd.be",
            "ReturnURLCancel": "https://stamhoofd.be",
            "ReturnURLError": "https://stamhoofd.be",
            "ReturnURLReject": "https://stamhoofd.be",
        }

        try {
            const response = await this.request("POST", "/json/Transaction", data)
            const key = response["Key"]

            if (!key) {
                return false
            }
            const status = this.getStatusFromResponse(response)

            return status === PaymentStatus.Pending || status === PaymentStatus.Created || status === PaymentStatus.Succeeded
        } catch (e) {
            console.error(e)
        }
        return false
    }

    async createPayment(payment: Payment, ip: string, description: string, returnUrl: string, exchangeUrl: string): Promise<string | null> {
        let service: any;

        switch (payment.method) {
            case PaymentMethod.iDEAL: {
                service = {
                    "Name": "ideal",
                    "Action": "Pay",
                    "Parameters": []
                };
                break;
            }
            case PaymentMethod.CreditCard: {
                service ={
                    "Name": "mastercard",
                    "Action": "Pay"
                };
                break;
            }

            case PaymentMethod.Bancontact: {
                service = {
                    "Name": "bancontactmrcash",
                    "Action": "Pay",
                    "Parameters": [
                        {
                            "Name": "savetoken",
                            "Value": "false"
                        }
                    ]
                };
                break;
            }

            case PaymentMethod.Payconiq: {
                service = {
                    "Name": "payconiq",
                    "Action": "Pay"
                };
                break;
            }
        }
        
        const data = {
            "Currency": "EUR",
            "AmountDebit": (payment.price / 100).toFixed(2),
            "Invoice": "ID " + payment.id,
            "ClientIP": {
                "Type": 0, // 0 = ipv4, 1 = ipv6
                "Address": ip
            },
            "Services": {
                "ServiceList": [
                    service
                ]
            },
            "ContinueOnIncomplete": "1", // iDEAL
            "Description": description,
            "PushURL": exchangeUrl,
            "PushURLFailure": exchangeUrl,
            "ReturnURL": returnUrl,
            "ReturnURLCancel": returnUrl,
            "ReturnURLError": returnUrl,
            "ReturnURLReject": returnUrl,
        }

        try {
            const response = await this.request("POST", "/json/Transaction", data)
            const key = response["Key"]

            if (!key) {
                throw new Error("Failed to create payment, missing key")
            }

            payment.status = this.getStatusFromResponse(response)

            // Save payment
            const dbPayment = new BuckarooPayment()
            dbPayment.paymentId = payment.id
            dbPayment.transactionKey = key
            await dbPayment.save();

            return response["RequiredAction"]?.["RedirectURL"] ?? null;
        } catch (e) {
            console.error(e)
            throw new SimpleError({
                code: "buckaroo_error",
                message: "Failed to create payment",
                human: "Er ging iets mis bij het starten van de betaling. Herlaad de pagina en probeer het opnieuw."
            })
        }
        
    }

    private getStatusFromResponse(data: any) {
        const status: string = data["Status"]?.["Code"]?.["Code"]?.toString() ?? ""
        if (status === "190") {
            return PaymentStatus.Succeeded
        }

        if (["490", "491", "492", "890", "891", "690"].includes(status)) {
            return PaymentStatus.Failed
        }

        if (["790"].includes(status)) {
            // Pending input
            return PaymentStatus.Created
        }

        if (["791", "792"].includes(status)) {
            // Pending input
            return PaymentStatus.Pending
        }

        console.warn("Unknown buckaroo status: " + status+" for ", data)
        return PaymentStatus.Pending
    }

    /**
     * Get the status of a payment
     */
    async getStatus(payment: Payment) {
        const buckarooPayments = await BuckarooPayment.where({ paymentId: payment.id}, { limit: 1 })
        if (buckarooPayments.length != 1) {
            throw new Error("Failed to find Buckaroo payment for payment " + payment.id)
        }
        const buckarooPayment = buckarooPayments[0]
        
        // Send request
        const response = await this.request("GET", "/json/transaction/status/" + buckarooPayment.transactionKey, undefined)
        const parameters = response["Services"]?.[0]?.["Parameters"]

        if (parameters && Array.isArray(parameters)) {
            const iban = parameters.find(p => p.Name.toLowerCase() === "customeriban")?.Value

            if (iban) {
                payment.iban = iban
            }

            const name = parameters.find(p => p.Name.toLowerCase() === "customeraccountname")?.Value

            if (name) {
                payment.ibanName = name
            }
        }

        const name = response["CustomerName"]

        if (name) {
            payment.ibanName = name
        }

        // Read status
        return this.getStatusFromResponse(response)
    }
}