import { AccountId, Client, PrivateKey, PublicKey } from "@hashgraph/sdk";
import { NextApiRequest, NextApiResponse } from "next";
import { getCsrfToken } from "next-auth/react";


export interface InitializingResponse {
    signature: Uint8Array,
    serverSigningAccount: string,
    payload: any
}

/**
 * call this function from a route that spouse to initiate the authentication with hashpack wallet. it signs a data and pass it to client.
 * @param req {NextApiRequest} 
 * @param res {NextApiResponse}
 * @param accountId {string} Sever's account Id on Hedera Hashgraph network
 * @param privateKey {PrivateKey} Server's account private key on Hedera Hashgraph
 * @param data {any} the data you are going to sign
 * @param network {'test' | 'main'} using Hedera's testnet or mainnet
 * @returns {Promise<void>}
 */
export default async function hashpackAuthInitializer(req: NextApiRequest, res: NextApiResponse, accountId: string, privateKey: PrivateKey | string, data: any, network: 'test' | 'main' = 'test'): Promise<void> {
    try {
        if (req.method !== 'POST') {
            res.status(405).send(`Method not allowed.`);
            return;
        }

        const csrfToken = await getCsrfToken({ req });
        if (!csrfToken || req.cookies['next-auth.csrf-token']?.split('|')?.[0] !== csrfToken) {
            throw new Error("Invalid token");
        }

        const client = network === 'test' ? Client.forTestnet() : Client.forMainnet();
        if (typeof privateKey === 'string') {
            privateKey = PrivateKey?.fromString(privateKey)
        }
        client.setOperator(AccountId.fromString(accountId), privateKey);

        let bytes = new Uint8Array(Buffer.from(JSON.stringify(data)));

        let signature = privateKey.sign(bytes);

        const responseDate: InitializingResponse = {
            signature: signature,
            serverSigningAccount: accountId,
            payload: data
        }

        res.status(200).send(JSON.stringify(responseDate));
        return;
    } catch (err: any) {
        res.status(403).send(err.message);
    }
}