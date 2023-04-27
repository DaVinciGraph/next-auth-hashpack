import { AccountId, Client, PrivateKey } from "@hashgraph/sdk";
import { NextApiRequest, NextApiResponse } from "next";
import { HederaNetworkType, debugging, isValidHederaAccount, truncatePrivateKey } from "./hashpackProvider";


export interface InitializingResponse {
    signature: Uint8Array,
    serverSigningAccount: string,
    payload: any
}

export interface IPreInitializingCallback {
    network: HederaNetworkType
    accountId: string
    data?: any
}

export type PreInitializingCallback = ({ network, accountId, data }: IPreInitializingCallback) => void;

/**
 * call this function from a route that spouse to initiate the authentication with hashpack wallet. it signs a data and pass it to client.
 * @param req {NextApiRequest} 
 * @param res {NextApiResponse}
 * @param ServerAccountId {string} Sever's account Id on Hedera Hashgraph network
 * @param ServerPrivateKey {PrivateKey} Server's account private key on Hedera Hashgraph
 * @param data {any} the data you are going to sign
 * @param network {'testnet' | 'mainnet' | previewnet} using Hedera's testnet or mainnet
 * @param preInitializingCallback runs after validation, receives accountId and optionally original data
 * @returns {Promise<void>}
 */
export async function authInitializer(req: NextApiRequest, res: NextApiResponse, ServerAccountId: string, ServerPrivateKey: string, data: any, network: HederaNetworkType = "testnet", preInitializingCallback?: PreInitializingCallback, debug: boolean = false): Promise<void> {
    try {
        if (req.method !== 'POST') {
            debugging(debug, "method wasn't allowed: ", req.method);
            return res.status(405).send(`Method not allowed.`);
        }

        if (!req.body?.accountId || !isValidHederaAccount(req.body?.accountId)) {
            debugging(debug, "Invalid hedera account ID: ", req.body?.accountId);
            throw new Error("Invalid hedera account ID.");
        }

        debugging(debug, "reading csrt-token", req.body?.accountId);
        const csrfToken = req.headers['x-csrf-token'] || req.body?.csrfToken;
        const csrfCookie = req.cookies['__Host-next-auth.csrf-token'] || req.cookies['next-auth.csrf-token'];
        debugging(debug, "crf token: ", csrfToken, " csrf cookie: ", csrfCookie);

        if (!csrfToken || (csrfCookie)?.split(/[|%]/)?.[0] !== csrfToken) {
            debugging(debug, "crf token and cookie didn't match.");
            throw new Error("Invalid token");
        }

        if (preInitializingCallback) {
            debugging(debug, "preInitializingCallback is about to run");
            await preInitializingCallback({ accountId: req.body.accountId, network, data })
            debugging(debug, "preInitializingCallback ran");
        }

        const client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
        debugging(debug, "hedera client was set for network: ", network);

        const pk = PrivateKey.fromString(ServerPrivateKey)
        debugging(debug, "Private key instance was created from string", truncatePrivateKey(ServerPrivateKey));

        client.setOperator(AccountId.fromString(ServerAccountId), pk);
        debugging(debug, "hedera client operator was set: ", ServerAccountId);

        let bytes = new Uint8Array(Buffer.from(JSON.stringify(data)));
        debugging(debug, "bytes was generated: ", bytes);

        let signature = pk.sign(bytes);

        const responseDate: InitializingResponse = {
            signature: signature,
            serverSigningAccount: ServerAccountId,
            payload: data,
        }

        debugging(debug, "response was sent: ", responseDate);

        return res.status(200).send(JSON.stringify(responseDate));
    } catch (err: any) {
        return res.status(403).send(err?.message ? err.message : "something went wrong. try again");
    }
}

