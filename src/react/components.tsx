import * as React from "react";
import { HashConnect } from "hashconnect";
import { ClientSafeProvider, getCsrfToken, getProviders, signIn, SignInOptions, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { css } from "@emotion/react";
import { HashConnectConnectionState } from "hashconnect/dist/esm/types";


export type AuthenticationResponse = {
    success: boolean;
    error?: string;
    signedPayload?: object;
    userSignature?: object;
};

export interface IAuthHashConnectIntegration {
    hashConnect: HashConnect,
    hashConnectTopic: string,
    hashConnectState?: HashConnectConnectionState,
    pairedAccountId: string,
    signInOptions?: SignInOptions,
    authInitializerApiRoute?: string
}

export interface IAuthHashPackButton extends IAuthHashConnectIntegration {
    children?: React.ReactNode,
    id?: string,
    className?: string,
    style?: any
}

export const useHashpackAuthentication = (hashConnect: HashConnect, hashConnectTopic: string, pairedAccountId: string, singInOptions?: SignInOptions, authInitializerApiRoute?: string) => {
    const [error, setError] = React.useState('');
    const router = useRouter();
    const authenticate = async (ApiRouteUrl = authInitializerApiRoute ? authInitializerApiRoute : `/api/auth/hashpack`) => {
        try {
            const csrfToken = await getCsrfToken();
            setError('');
            const transactionResponse = await fetch(ApiRouteUrl, {
                method: "POST",
                body: JSON.stringify({
                    csrfToken: csrfToken,
                    accountId: pairedAccountId
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (transactionResponse.status === 200) {
                const { signature, serverSigningAccount, payload } = await transactionResponse.json();

                const editedSignature = Uint8Array.from(Object.values(signature));

                let authenticationResponse = await hashConnect.authenticate(hashConnectTopic, pairedAccountId, serverSigningAccount, editedSignature, payload);

                if (!authenticationResponse.success) {
                    throw new Error("Hashpack wallet failed to authenticate");
                }

                await sign(authenticationResponse);

            } else {
                let err: string;
                if (transactionResponse.status === 404) {
                    err = "hashpack authentication initializer route not found."
                } else {
                    const contentType = transactionResponse.headers.get('content-type');
                    if (contentType?.includes('application/json')) {
                        err = await transactionResponse.json();
                    } else {
                        err = await transactionResponse.text();
                    }
                }
                setError(err)
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    const sign = async (authenticationResponse: any) => {
        const signInResponse = await signIn("hashpack", {
            accountId: pairedAccountId,
            signedPayload: JSON.stringify(authenticationResponse.signedPayload),
            userSignature: JSON.stringify(authenticationResponse.userSignature),
            redirect: false,
            json: true,
            ...singInOptions
        });

        if (signInResponse?.ok) {
            if (singInOptions?.callbackUrl)
                router.push(singInOptions?.callbackUrl);
        } else {
            setError(signInResponse?.error as string);
        }
    }

    return { authenticate, sign, error };
}


export const HashpackButton = (props: IAuthHashPackButton) => {
    const { hashConnect, hashConnectTopic, hashConnectState, pairedAccountId, children, signInOptions, authInitializerApiRoute } = props;
    const { authenticate, error } = useHashpackAuthentication(hashConnect, hashConnectTopic, pairedAccountId, signInOptions!, authInitializerApiRoute);

    const [pairedHere, setPairedHere] = React.useState(false);

    const initializeHashpackAuthentication = async () => {
        if (hashConnectState !== 'Paired') {
            setPairedHere(true);
            hashConnect.connectToLocalWallet();
            return;
        } else {
            setPairedHere(false);
        }

        authenticate();
    }

    React.useEffect(() => {
        if (hashConnectState === 'Paired' && pairedHere) authenticate();
    }, [hashConnectState]);

    return <>
        <span><button
            onClick={initializeHashpackAuthentication}
            disabled={hashConnectState === 'Disconnected'}
            className={`${props?.className && props.className}`}
            css={css`
            background-color: #525298;
            border: 1px solid hsla(0, 0%, 100%, .05);
            display: flex;
            align-items: center;
            color: #fff;
            font-weight: bold;
            width: 100%;
            margin: 10px 0px;
            border-radius: 5px;
            justify-content: start;
            cursor: pointer;
            padding-block: 5px;
            padding-inline: 20px;
            font-size: 14pt;
            &:disabled {
                opacity: 0.6;
            }`}
            id={props?.id && props.id}
            style={props?.style && props.style}
        >
            {
                children ? children :
                    <>
                        <img src="https://uploads-ssl.webflow.com/61ce2e4bcaa2660da2bb419e/62e14973c65367120073a891_app-icon.webp" style={{ margin: "10px" }} loading="lazy" alt="" width={32} height={32} />
                        Sign in with Hashpack
                    </>

            }
        </button>
            {error && <div style={{ color: "#ff4747", paddingBottom: "5px" }}>{error}</div>}
        </span>
    </>
}

export const ProvidersCard = (props: IAuthHashConnectIntegration) => {
    const { hashConnect, hashConnectTopic, hashConnectState, pairedAccountId, signInOptions, authInitializerApiRoute } = props;
    const [providers, setProviders] = React.useState<ClientSafeProvider[]>([]);

    const init = async () => {
        const availableProvider = await getProviders();

        if (availableProvider) {
            setProviders(Object.values(availableProvider));
        }
    }

    React.useEffect(() => {
        init();
    }, []);

    return <div>
        {
            Array.isArray(providers) && providers.map((provider: any) => {
                return provider.id === 'hashpack' ? <div key={provider.id}>
                    <HashpackButton
                        hashConnect={hashConnect}
                        pairedAccountId={pairedAccountId}
                        hashConnectTopic={hashConnectTopic}
                        hashConnectState={hashConnectState}
                        signInOptions={signInOptions}
                        authInitializerApiRoute={authInitializerApiRoute} />
                </div> : <div key={provider.id}>
                    <button type="submit"
                        css={css`
                    background-color: #eee;
                    border: 1px solid hsla(0, 0%, 100%, .05);
                    display: flex;
                    align-items: center;
                    font-weight: bold;
                    width: 100%;
                    margin: 10px 0px;
                    border-radius: 5px;
                    justify-content: start;
                    cursor: pointer;
                    padding-block: 5px;
                    padding-inline: 20px;
                    font-size: 14pt;
                    &:disabled {
                        opacity: 0.6;
                    }`}
                        className="next-auth-provider-button" onClick={() => signIn(provider.id, { callbackUrl: provider.callbackUrl })}>
                        <img loading="lazy" id="provider-logo" src={`https://authjs.dev/img/providers/${provider.id}.svg`} style={{ margin: "10px" }} width={32} height={32} />
                        <span>Sign in with {provider.name}</span>
                    </button>
                </div>
            })
        }
    </div>
}



export const SignInSection = (props: IAuthHashConnectIntegration) => {
    const { hashConnect, hashConnectTopic, hashConnectState, pairedAccountId, signInOptions, authInitializerApiRoute } = props;
    const router = useRouter();
    const { status: sessionStatus } = useSession();

    if (sessionStatus === 'authenticated') router.push("/");

    return (
        <section style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: "100px"
        }}>
            <article style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0px 0px 1px #4B0082',
                padding: '20px 30px 50px 30px',
                borderRadius: '20px',
            }}>
                <h1 style={{
                    paddingBlock: '20px',
                    fontSize: '24pt',
                    fontFamily: 'tahoma',
                }}>Sign In</h1>
                <ProvidersCard hashConnect={hashConnect}
                    pairedAccountId={pairedAccountId}
                    hashConnectState={hashConnectState}
                    hashConnectTopic={hashConnectTopic}
                    signInOptions={signInOptions}
                    authInitializerApiRoute={authInitializerApiRoute} />
            </article>
        </section>
    )
}
