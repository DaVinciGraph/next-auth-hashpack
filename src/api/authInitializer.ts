import { AccountId, Client, PrivateKey } from "@hashgraph/sdk";
import { NextApiRequest, NextApiResponse } from "next";
import { getCsrfToken } from "next-auth/react";
import { isValidHederaAccount } from "./hashpackProvider";


export interface InitializingResponse {
    signature: Uint8Array,
    serverSigningAccount: string,
    payload: any
}

type PreInitializingCallback = (accountId: string, data?: any) => void;

/**
 * call this function from a route that spouse to initiate the authentication with hashpack wallet. it signs a data and pass it to client.
 * @param req {NextApiRequest} 
 * @param res {NextApiResponse}
 * @param ServerAccountId {string} Sever's account Id on Hedera Hashgraph network
 * @param ServerPrivateKey {PrivateKey} Server's account private key on Hedera Hashgraph
 * @param data {any} the data you are going to sign
 * @param network {'testnet' | 'mainnet'} using Hedera's testnet or mainnet
 * @param preInitializingCallback runs after validation, receives accountId and optionally original data
 * @returns {Promise<void>}
 */
export async function authInitializer(req: NextApiRequest, res: NextApiResponse, ServerAccountId: string, ServerPrivateKey: string, data: any, network: "testnet" | "mainnet" = "testnet", preInitializingCallback?: PreInitializingCallback): Promise<void> {
    try {
        if (req.method !== 'POST') {
            return res.status(405).send(`Method not allowed.`);
        }

        if (!req.body?.accountId || !isValidHederaAccount(req.body?.accountId)) {
            throw new Error("Invalid hedera account ID.");
        }

        const csrfToken = await getCsrfToken({ req });
        if (!csrfToken || req.cookies['next-auth.csrf-token']?.split('|')?.[0] !== csrfToken) {
            throw new Error("Invalid token");
        }

        if (preInitializingCallback) {
            await preInitializingCallback(req.body.accountId)
        }

        const client = network === 'testnet' ? Client.forTestnet() : Client.forMainnet();
        // if (typeof privateKey === 'string') {
        const pk = PrivateKey.fromString(ServerPrivateKey)
        // }
        client.setOperator(AccountId.fromString(ServerAccountId), pk);

        let bytes = new Uint8Array(Buffer.from(JSON.stringify(data)));

        let signature = pk.sign(bytes);

        const responseDate: InitializingResponse = {
            signature: signature,
            serverSigningAccount: ServerAccountId,
            payload: data
        }

        return res.status(200).send(JSON.stringify(responseDate));
    } catch (err: any) {
        return res.status(403).send(err?.message ? err.message : "something went wrong. try again");
    }
}

