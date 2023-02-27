import { HashConnect } from "hashconnect"
import { SignInOptions } from "next-auth/react";
import { ReactNode, StyleHTMLAttributes } from "react";

export type AuthenticationResponse = {
    success: boolean;
    error?: string;
    signedPayload?: object;
    userSignature?: object;
};

export declare const useHashpackAuthentication: (
    hashconnect: HashConnect,
    hashconnectTopic: string,
    pairedAccountId: string
) => {
    authenticate: (ApiRouteUrl?: string) => Promise<void>;
    sign: (authenticationResponse: AuthenticationResponse) => Promise<void>;
    error?: string;
};




export interface IAuthHashConnectIntegration {
    hashconnect: HashConnect,
    hashconnectTopic: string,
    pairedAccountId: string,
    signInOptions?: SignInOptions,
    authInitializerApiRoute?: string
}

export interface IAuthHashPackButton extends IAuthHashConnectIntegration {
    children?: ReactNode,
    id?: string,
    className?: string,
    style?: any
}


export const HashpackButton: (props: IAuthHashPackButton) => ReactNode;