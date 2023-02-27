import { PublicKey } from "@hashgraph/sdk";
import Credentials, { CredentialsConfig } from "next-auth/providers/credentials";

export interface HashpackOptions {
    userReturnCallback: Function,
    publicKey: string,
    mirrorNodeAccountInfoURL?: string,
    getUserPublicKey?: Function
}

/**
 * config the credential to be used with hashpack wallet
 * 
 * @param userReturnCallback a callback that return verfied user
 * @param publicKey Server's Hedera account public key
 * @param mirrorNodeAccountInfoURL  the mirror node api route for  fetching account's info
 * @param getUserPublicKey replace the fetching client user's public key mechanizm
 */
export const hashpackProvider = ({ userReturnCallback, publicKey, mirrorNodeAccountInfoURL = 'https://testnet.mirrornode.hedera.com/api/v1/accounts', getUserPublicKey }: HashpackOptions) => {
    return Credentials({
        id: "hashpack",
        name: 'Hashpack wallet',
        credentials: {
            signedPayload: { label: '', type: "hidden" },
            userSignature: { label: '', type: "hidden" },
            accountId: { label: '', type: "hidden" },
        },
        async authorize(credentials: any, req: any) {
            let { signedPayload, userSignature, accountId } = credentials;

            if (!signedPayload || !userSignature || !accountId) {
                throw new Error("unable to process your request")
            }

            try {
                signedPayload = JSON.parse(signedPayload);
                userSignature = JSON.parse(userSignature);
            } catch (err) {
                throw new Error("Invalid Signature");
            }

            if (!signedPayload?.originalPayload || !signedPayload.serverSignature) {
                throw new Error("Invalid entries");
            }

            if (!isUint8ArrayCompatible(signedPayload.serverSignature) || !isUint8ArrayCompatible(userSignature)) {
                throw new Error("Invalid Signature");
            }

            let userAccountPublicKey = '';
            if (getUserPublicKey) {
                userAccountPublicKey = await getUserPublicKey();
            } else {
                const userAccountInfoResponse = await fetch(`${mirrorNodeAccountInfoURL}/${accountId}`);
                if (userAccountInfoResponse.ok) {
                    const responseData = await userAccountInfoResponse.json();
                    userAccountPublicKey = responseData?.key?.key;
                }
            }

            if (!userAccountPublicKey) {
                throw new Error("User public key is missing");
            }

            const serverVerified = verifyData(signedPayload.originalPayload, publicKey, Uint8Array.from(Object.values(signedPayload.serverSignature)));
            const clientVerified = verifyData(signedPayload, userAccountPublicKey, Uint8Array.from(Object.values(userSignature)));

            if (serverVerified && clientVerified) {
                return userReturnCallback(credentials)
            }

            throw new Error("Authentication Failed")
        }
    })
}

const verifyData = (data: object, publicKey: string, signature: Uint8Array): boolean => {
    const pubKey = PublicKey.fromString(publicKey);

    let bytes = new Uint8Array(Buffer.from(JSON.stringify(data)));

    let verify = pubKey.verify(bytes, signature);

    return verify;
}

const isUint8ArrayCompatible = (data: any) => {
    if (typeof data === 'object' && !Array.isArray(data) && data !== null) {
        data = Object.values(data);
    }

    if (!Array.isArray(data))
        return false;

    if (data.length % Uint8Array.BYTES_PER_ELEMENT !== 0)
        return false;

    return data.every(function (value) {
        return Number.isInteger(value) && value >= 0 && value <= 255;
    });
}