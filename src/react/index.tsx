import { HashConnect } from "hashconnect";
import { ClientSafeProvider, getCsrfToken, getProviders, signIn, SignInOptions, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { IAuthHashConnectIntegration, IAuthHashPackButton } from "./index.d"

export const useHashpackAuthentication = (hashconnect: HashConnect, hashconnectTopic: string, pairedAccountId: string, singInOptions?: SignInOptions, authInitializerApiRoute?: string) => {
    const [error, setError] = useState('');
    const router = useRouter();
    const authenticate = async (ApiRouteUrl = authInitializerApiRoute ? authInitializerApiRoute : `/api/auth/hashpack`) => {
        try {
            const csrfToken = await getCsrfToken();
            setError('');
            const transactionResponse = await fetch(ApiRouteUrl, {
                method: "POST",
                body: JSON.stringify({
                    csrfToken: csrfToken
                })
            });

            if (transactionResponse.status === 200) {
                const { signature, serverSigningAccount, payload } = await transactionResponse.json();

                const editedSignature = Uint8Array.from(Object.values(signature));

                let authenticationResponse = await hashconnect.authenticate(hashconnectTopic, pairedAccountId, serverSigningAccount, editedSignature, payload);

                if (!authenticationResponse.success) {
                    throw new Error("Hashpack wallet failed to authenticate");
                }

                await sign(authenticationResponse);

            } else {
                let err
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
    const { hashconnect, hashconnectTopic, pairedAccountId, children, signInOptions, authInitializerApiRoute } = props;
    const { authenticate, error } = useHashpackAuthentication(hashconnect, hashconnectTopic, pairedAccountId, signInOptions!, authInitializerApiRoute);

    const [hashconnectState, setHashconnectState] = useState(hashconnect.status);
    const [pairedHere, setPairedHere] = useState(false);

    hashconnect.connectionStatusChangeEvent.on((status: any) => {
        setHashconnectState(status);
    });

    const initializeHashpackAuthentication = async () => {
        if (hashconnectState !== 'Paired') {
            setPairedHere(true);
            hashconnect.connectToLocalWallet();
            return;
        } else {
            setPairedHere(false);
        }

        authenticate();
    }

    useEffect(() => {
        console.log(children)
    }, [])

    useEffect(() => {
        if (hashconnectState === 'Paired' && pairedHere) authenticate();
    }, [hashconnectState]);

    return <>
        <span><button
            onClick={initializeHashpackAuthentication}
            disabled={hashconnectState === 'Disconnected'}
            className={props?.className && props.className}
            id={props?.id && props.id}
            style={props?.style && props.style}
        >
            {
                children ? children :
                    <>
                        <img src="https://uploads-ssl.webflow.com/61ce2e4bcaa2660da2bb419e/62e14973c65367120073a891_app-icon.webp" loading="lazy" alt="" width={32} height={32} />
                        Sign in with Hashpack
                    </>

            }
        </button>
            {error && <div id="error">{error}</div>}
        </span>
        <style jsx>
            {`
                button {
                    background-color: #525298;
                    border: 1px solid hsla(0,0%,100%,.05);
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
                }

                img {
                    margin: 10px;
                }

                button[disabled]{
                    opacity: 0.6;
                }

                #error {
                    color: #ff4747;
                    padding-bottom: 5px;
                }
            `}
        </style>
    </>
}

export const ProvidersCard = (props: IAuthHashConnectIntegration) => {
    const { hashconnect, hashconnectTopic, pairedAccountId, signInOptions, authInitializerApiRoute } = props;
    const [providers, setProviders] = useState<ClientSafeProvider[]>([]);

    const init = async () => {
        const availableProvider = await getProviders();

        if (availableProvider) {
            setProviders(Object.values(availableProvider));
        }
    }

    useEffect(() => {
        init();
    }, []);

    return <div style={{ width: "320px" }}>
        {
            Array.isArray(providers) && providers.map((provider: any) => {
                return provider.id === 'hashpack' ? <div key={provider.id}>
                    <HashpackButton
                        hashconnect={hashconnect}
                        pairedAccountId={pairedAccountId}
                        hashconnectTopic={hashconnectTopic}
                        signInOptions={signInOptions}
                        authInitializerApiRoute={authInitializerApiRoute} />
                </div> : <div key={provider.id}>
                    <button type="submit" onClick={() => signIn(provider.id, { callbackUrl: provider.callbackUrl })}>
                        <img loading="lazy" id="provider-logo" src={`https://authjs.dev/img/providers/${provider.id}.svg`} width={32} height={32} />
                        <span>Sign in with {provider.name}</span>
                    </button>
                </div>
            })
        }
        <style jsx>{`
            button { 
                background-color: #eee;
                border: 1px solid hsla(0,0%,100%,.05);
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
            }

            button[disabled]{
                opacity: 0.6;
            }

            img {
                margin: 10px;
            }
        `}</style>
    </div>
}



export const SignInSection = (props: IAuthHashConnectIntegration) => {
    const { hashconnect, hashconnectTopic, pairedAccountId, signInOptions, authInitializerApiRoute } = props;
    const router = useRouter();
    const { status: sessionStatus } = useSession();

    if (sessionStatus === 'authenticated') router.push("/");

    return (
        <section>
            <article>
                <h1>Sign In</h1>
                <ProvidersCard hashconnect={hashconnect}
                    pairedAccountId={pairedAccountId}
                    hashconnectTopic={hashconnectTopic}
                    signInOptions={signInOptions}
                    authInitializerApiRoute={authInitializerApiRoute}></ProvidersCard>
            </article>
            <style jsx>
                {`
                    section {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-top: 100px;
                    }

                    article {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        box-shadow: 0px 0px 1px #4B0082;
                        padding: 20px 30px 50px 30px;
                        border-radius: 20px;
                    }

                    h1 {
                        padding-block: 20px;
                        font-size: 24pt;
                        font-family: tahoma;
                    }
                `}
            </style>
        </section>
    )
}
