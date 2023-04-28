import { PrivateKey, PublicKey } from "@hashgraph/sdk";
import { Awaitable, User } from "next-auth";
import Credentials, { CredentialsConfig } from "next-auth/providers/credentials";

export type HederaNetworkType = 'mainnet' | 'testnet' | 'previewnet'

export interface HashpackCredentialInputData {
    signedPayload?: Uint8Array,
    userSignature?: Uint8Array,
    accountId?: string
    network?: HederaNetworkType
}

export interface IGetUserPublicKey {
    accountId: string,
    network: HederaNetworkType
}

export interface ICheckOriginalData {
    accountId: string
    network: HederaNetworkType
    originalData: any
}

export interface networkRelatedObject {
    testnet: string,
    mainnet: string,
    previewnet?: string
}

export interface HashpackOptions {
    userReturnCallback: (credentials: HashpackCredentialInputData, userPublicKey?: string) => Awaitable<User | null>,
    privateKey: string | networkRelatedObject | ((network: HederaNetworkType) => string),
    mirrorNodeAccountInfoURL?: networkRelatedObject,
    getUserPublicKey?: (({ accountId, network }: IGetUserPublicKey) => string | Promise<string>) | null,
    checkOriginalData?: ({ accountId, network, originalData }: ICheckOriginalData) => boolean | Promise<boolean>
    debug?: boolean
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
    network: {
        label: string;
        type: string;
    };
}

/**
 * config the credential to be used with hashpack wallet
 * 
 * @param userReturnCallback a callback that return verified user
 * @param privateKey Server's Hedera account private key, can be an object of privatekey strings for each networks
 * @param mirrorNodeAccountInfoURL  the mirror node api route for  fetching account's info
 * @param getUserPublicKey replace the fetching client user's public key mechanism
 * @param checkOriginalData check the original data
 */
export const hashpackProvider = ({
    userReturnCallback,
    privateKey,
    mirrorNodeAccountInfoURL = {
        testnet: 'https://testnet.mirrornode.hedera.com/api/v1/accounts',
        mainnet: 'https://mainnet-public.mirrornode.hedera.com/api/v1/accounts',
        previewnet: ""
    },
    getUserPublicKey = null,
    checkOriginalData,
    debug = false
}: HashpackOptions): CredentialsConfig<hashpackCredentialInputs> => {
    return Credentials({
        id: "hashpack",
        name: 'Hashpack wallet',
        credentials: {
            signedPayload: { label: '', type: "hidden" },
            userSignature: { label: '', type: "hidden" },
            accountId: { label: '', type: "hidden" },
            network: { label: '', type: "hidden" },
        },
        async authorize(credentials: any) {
            let { signedPayload, userSignature, accountId, network } = credentials;
            debugging(debug, "red credentials: ", credentials);

            if (!signedPayload || !userSignature || !accountId || !network) {
                debugging(debug, "missing credentials ");
                throw new Error("unable to process your request")
            }

            if (!isValidHederaAccount(accountId)) {
                debugging(debug, "user account was invalid in format.");
                throw new Error("Hedera Account is not valid.");
            }

            if (network !== 'mainnet' && network !== 'testnet' && network !== 'previewnet') {
                debugging(debug, "hedera account was invalid.");
                throw new Error("Hedera network is incorrect.");
            }

            try {
                debugging(debug, "convert signedPayload and userSignature to json.");
                signedPayload = JSON.parse(signedPayload);
                userSignature = JSON.parse(userSignature);
            } catch (err) {
                debugging(debug, "one or both of them were invalid.");
                throw new Error("Invalid Signature");
            }

            if (!signedPayload?.originalPayload || !signedPayload?.serverSignature) {
                debugging(debug, "one or both of them were null or undefined.");
                throw new Error("Invalid entries");
            }

            if (!isUint8ArrayCompatible(signedPayload.serverSignature) || !isUint8ArrayCompatible(userSignature)) {
                debugging(debug, "one or both of were not a valid Uint8Array.");
                throw new Error("Invalid Signature");
            }

            debugging(debug, "checking data if present runs.");
            if (checkOriginalData && !checkOriginalData({ accountId, network, originalData: signedPayload?.originalPayload })) {
                debugging(debug, "originalData returned error.");
                throw new Error("Invalid Signature");
            }
            debugging(debug, "originalData passed.");

            debugging(debug, "trying to get user public key.");
            let userAccountPublicKey = '';
            if (getUserPublicKey !== null && typeof getUserPublicKey === 'function') {
                debugging(debug, "getting user public key in a custom way");
                userAccountPublicKey = await getUserPublicKey({ accountId, network });
                debugging(debug, "result of custom public key getter: ", userAccountPublicKey);
            } else {
                debugging(debug, "getting user public key from mirror node: ", mirrorNodeAccountInfoURL[network], mirrorNodeAccountInfoURL, network);
                const userAccountInfoResponse = await fetch(`${mirrorNodeAccountInfoURL[network]}/${accountId}`);
                if (userAccountInfoResponse.ok) {
                    const responseData = await userAccountInfoResponse.json();
                    userAccountPublicKey = responseData?.key?.key;
                    debugging(debug, "user public key was returned successfully: ", userAccountPublicKey);
                }
            }

            if (!userAccountPublicKey) {
                debugging(debug, "user public key wasn't present.", userAccountPublicKey);
                throw new Error("User public key is missing");
            }

            let pv: null | string | networkRelatedObject = null;
            if (typeof privateKey === 'function') {
                debugging(debug, "getting server private Key from a callback.");
                pv = privateKey(network);
                debugging(debug, "returned private key: ", truncatePrivateKey(pv));
            } else if (serverPrivateKeyIsNetworkRelated(privateKey)) {
                debugging(debug, "getting server private Key from an object.");
                pv = privateKey[network] as string;
                if (!pv) {
                    debugging(debug, "object didn't contained network: ", network);
                    throw new Error(`Server Internal Error.`);
                }
                debugging(debug, "returned private key: ", truncatePrivateKey(pv));
            } else {
                pv = privateKey;
                debugging(debug, "private key: ", truncatePrivateKey(pv));
            }


            debugging(debug, "verifying validation of signatures.");

            const serverVerified = verifyData(signedPayload.originalPayload, PrivateKey.fromString(pv).publicKey, Uint8Array.from(Object.values(signedPayload.serverSignature)));
            debugging(debug, "server signature verifying result: ", serverVerified);

            const clientVerified = verifyData(signedPayload, userAccountPublicKey, Uint8Array.from(Object.values(userSignature)));
            debugging(debug, "user signature verifying result: ", clientVerified);

            if (serverVerified && clientVerified) {
                debugging(debug, "successful authorization");
                return userReturnCallback(credentials, userAccountPublicKey)
            }

            throw new Error("Authentication Failed")
        }
    })
}

const verifyData = (data: object, publicKey: string | PublicKey, signature: Uint8Array): boolean => {
    const pubKey = publicKeyIsString(publicKey) ? PublicKey.fromString(publicKey) : publicKey;

    let bytes = new Uint8Array(Buffer.from(JSON.stringify(data)));

    let verify = pubKey.verify(bytes, signature);

    return verify;
}

const serverPrivateKeyIsNetworkRelated = (serverPublicKey: string | networkRelatedObject): serverPublicKey is networkRelatedObject => {
    return typeof serverPublicKey !== 'string'
}

const publicKeyIsString = (publicKey: string | PublicKey): publicKey is string => {
    return typeof publicKey === 'string';
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

export const debugging = (active: boolean, ...rest: any[]) => {
    if (active) {
        console.log(`${new Date().toISOString()}: `, ...rest);
    }
}

export function isValidHederaAccount(accountId: string) {
    const regex = /^(\d{1,10}\.){2}\d{1,10}$/;
    return regex.test(accountId);
}

export const truncatePrivateKey = (privateKey: string): string | false => {
    if (privateKey.length < 6) {
        return false;
    }

    const firstThreeChars = privateKey.slice(0, 3);
    const lastThreeChars = privateKey.slice(-3);

    return `${firstThreeChars}...${lastThreeChars}`;
}