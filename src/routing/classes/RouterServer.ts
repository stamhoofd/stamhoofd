import { Router } from "./Router";
import http from "http";
import { Request } from "./Request";

export class RouterServer {
    router: Router;
    server?: http.Server;

    constructor(router: Router) {
        this.router = router;
    }

    async requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
        let request: Request;
        try {
            request = Request.fromHttp(req);
        } catch (e) {
            console.error(e);
            res.end();
            return;
        }

        try {
            const response = await this.router.run(request);
            if (!response) {
                res.writeHead(404);
                res.end("Endpoint not found.");
            } else {
                res.writeHead(response.status, response.headers);
                res.end(response.body);
            }
        } catch (e) {
            // Todo: implement special errors to send custom status codes
            res.writeHead(400);
            res.end(e.message);
            return;
        }
    }

    listen(port: 8080) {
        if (this.server) {
            throw new Error("Already listening.");
        }
        console.log("Starting server...");
        this.server = http.createServer(this.requestListener.bind(this));
        this.server.listen(port, "127.0.0.1", () => {
            console.log("Server running at http://127.0.0.1:" + port);
        });
    }

    async close(): Promise<Error | undefined> {
        console.log("Stoppping server...");
        return new Promise((resolve, reject) => {
            if (!this.server) {
                throw new Error("Already stopped.");
            }
            this.server.close(err => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
            this.server = undefined;
        });
    }
}
