import { PublicKey } from "@hashgraph/sdk";
import { Awaitable, User } from "next-auth";
import Credentials, { CredentialsConfig } from "next-auth/providers/credentials";

export interface HashpackCredentialInputData {
    signedPayload?: Uint8Array,
    userSignature?: Uint8Array,
    accountId?: string
}

export interface HashpackOptions {
    userReturnCallback: (credentials: HashpackCredentialInputData) => Awaitable<User | null>,
    publicKey: string,
    mirrorNodeAccountInfoURL?: string,
    getUserPublicKey?: (accountId: string) => string,
    checkOriginalData?: (accountId: string, originalData: any) => boolean | Promise<boolean>
}

export type hashpackCredentialInputs = {
    signedPayload: {
        label: string;
        type: string;
    };
    userSignature: {
        label: string;
        type: string;
    };
    accountId: {
        label: string;
        type: string;
    };
}

/**
 * config the credential to be used with hashpack wallet
 * 
 * @param userReturnCallback a callback that return verified user
 * @param publicKey Server's Hedera account public key
 * @param mirrorNodeAccountInfoURL  the mirror node api route for  fetching account's info
 * @param getUserPublicKey replace the fetching client user's public key mechanism
 * @param checkOriginalData check the original data
 */
export const hashpackProvider = ({
    userReturnCallback,
    publicKey,
    mirrorNodeAccountInfoURL = 'https://testnet.mirrornode.hedera.com/api/v1/accounts',
    getUserPublicKey,
    checkOriginalData
}: HashpackOptions): CredentialsConfig<hashpackCredentialInputs> => {
    return Credentials({
        id: "hashpack",
        name: 'Hashpack wallet',
        credentials: {
            signedPayload: { label: '', type: "hidden" },
            userSignature: { label: '', type: "hidden" },
            accountId: { label: '', type: "hidden" },
        },
        async authorize(credentials: any) {
            let { signedPayload, userSignature, accountId } = credentials;

            if (!signedPayload || !userSignature || !accountId) {
                throw new Error("unable to process your request")
            }

            if (!isValidHederaAccount(accountId)) {
                throw new Error("Hedera Account is not valid.");
            }

            try {
                signedPayload = JSON.parse(signedPayload);
                userSignature = JSON.parse(userSignature);
            } catch (err) {
                throw new Error("Invalid Signature");
            }

            if (!signedPayload?.originalPayload || !signedPayload?.serverSignature) {
                throw new Error("Invalid entries");
            }

            if (!isUint8ArrayCompatible(signedPayload.serverSignature) || !isUint8ArrayCompatible(userSignature)) {
                throw new Error("Invalid Signature");
            }

            if (checkOriginalData && !checkOriginalData(accountId, signedPayload?.originalPayload)) {
                throw new Error("Invalid Signature");
            }

            let userAccountPublicKey = '';
            if (getUserPublicKey) {
                userAccountPublicKey = await getUserPublicKey(accountId);
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

export function isValidHederaAccount(accountId: string) {
    const regex = /^(\d{1,10}\.){2}\d{1,10}$/;
    return regex.test(accountId);
}