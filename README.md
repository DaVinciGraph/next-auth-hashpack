# next-auth-hashpack

NextAuth.js is an open-source library that simplifies the implementation of authentication in serverless and server-rendered web applications using various authentication providers. It is built on top of the Next.js framework and provides a simple API and pre-built authentication providers. 

<br>
The next-auth-hashpack package is designed to enable NextAuth.js to use Hashpack Wallet as an authentication provider. With this package, users can sign in and initiate authentication using Hashpack Wallet for the entire authentication flow.

<br>

## install
`npm install next-auth-hashpack`

<br>

# The Flow

![Authentication Flow](AuthWithHashpack.jpg)

<br>

# Usage

<br>

## **HashpackProvider**

after configuring next-auth, call `HashpackProvider` in the providers array:

```javascript pages/api/auth/[...nextAuth].ts
NextAuth({
    providers: [
        hashpackProvider({
            userReturnCallback: ({ accountId }) => {
                return { id: "DavinciGraph", accountId: accountId }
            },
            publicKey: "ServerAccountPublicKey",
            mirrorNodeAccountInfoURL: "...",
            getUserPublicKey: (accountId) => {
                return "mechanism to return user's public key"
            },
        })
    ]
})
```

<br>

### __hashpackProvider Options__

**userReturnCallback** <br>
**_`mandatory`_** this callback would be executed when user is authenticated successfully. it gets credentials inputs including user's accountId which can be used to fetch user's data from for example a database.

```javascript pages/api/auth/[...nextAuth].ts
hashpackProvider({
    userReturnCallback: ({signedPayload, userSignature, accountId}) => {}
})
```

<br>

**publicKey** <br>
**_`mandatory`_** the server's hedera hashgraph account public key, this key would be used to verify the signed data.

<br>

**mirrorNodeAccountInfoURL** <br>
**_`optional for development`_** by default this package send an http request to hedera public mirror node to get the signing-in user public key so to verify the signed data. but it's only provided in for the testnet, so for the production you must give the mainnet url manually. <br>eg: `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/`

<br>

**getUserPublicKey** <br>
**_`optional`_** if you want to implement your mechanism to get user's account public key, you can pass a callback to this property. you'll get signing-in user account id as the input

```javascript pages/api/auth/[...nextAuth].ts
hashpackProvider({
    getUserPublicKey: (accountId) => {
        return "mechanism to return user's public key"
    }
})
```

<br>

## **authInitializer**
The usual next-auth providers have a similar flow to initiate authentication(since they implement OAuth standard), but with a cryptocurrency wallet this is not available. therefore we need another route, which must be created manually.

<br>

by default it's spoused to have a `hashpack.ts` file in `pages/api/auth`, containing a route that calls `authInitializer` as presented in the following snippet.

```javascript pages/api/auth/hashpack.ts
export default async function hashpack(req: NextApiRequest, res: NextApiResponse) {
    const accountId = "server's hedera account Id";
    const privateKey = PrivateKey.fromString("Server's hedera account private key");

    let data = {
        url: 'https://davincigraph.io', 
        token: "a randomly generated token"
    };

    authInitializer(req, res, accountId, privateKey, data, "test");
    // the final argument is hedera network, and it accepts either test or main
}
```

<br>

as you see, `authInitializer` requires the route `request` and `response`, server's Hedera hashgraph `account Id` and `private key`, and some `data` to be signed by both parts (server & user).

> 💡 the `pages/api/auth/hashpack.ts` path is not mandatory and the route can be created anywhere needed, the client knows about it in a way which would be explained in the following.

<br>

### Sign-in page
the other essential configuration for the next-auth is the sign-in page url. by default next-auth creates a page with this url pages/api/auth/signin. as you remembered crypto wallets cannot authenticate like oAuth providers by the default page treat all as that, so we cannot use it. instead we use some of next-auth-hashpack functionalities in the react.

to change the sign-in page url:

```javascript pages/api/[...nextAuth].ts
NextAuth({
    providers: [
        ...
    ],
    pages: {
        signIn: "/auth/signin" // you can write any path you want
    }
})
```

<br>
<br>
<br>

# React
The previous functionalities described are responsible for handling the authentication flow related to the backend. In contrast, the following section explains how the frontend handles the authentication flow.

<br>

## **hashconnect**
at any time, to be able to connect to hashpack we must instantiate `Hashconnect` and hold some of its properties as states. next-auth-hashpack need 3 entries to be able to interact with hashpack. the `hashconnect instance`, `hashconnect topic` and the state holding paired or to-be paired user's `account id`.

> 💡 Notice that another prerequisite is to have next-auth session context set up.

<br>

## **useHashpackAuthentication** hook
returns `authenticate` & `error` function which when called initiate the hashpack authentication flow, for example by clicking on a button.
```javascript 
useHashpackAuthentication(
    hashconnect, // the hashconnect instance 
    hashconnectTopic, // hashconnect's connection topic state
    pairedAccountId, // paired or to be paired account id state
    singInOptions, // Optional - next-auth sign-in options
    authInitializerApiRoute // Optional the route that initialize the authentication, as mentioned above the default path is `pages/api/auth/hashpack.ts`
)
```

> 💡 use this hook when you want to completely create a new UI for the sign-in options, otherwise next-auth-hashpack provide enough customizable components that satisfies every need.

<br>

## **HashpackButton component**
default next-auth-hashpack initializer button. it accepts all the useHashpackAuthentication inputs as props and also several props for the styling purposes.

```javascript
<HashpackButton
    hashconnect={hashconnect}
    pairedAccountId={pairedAccountId}
    hashconnectTopic={hashconnectTopic}
    signInOptions={signInOptions}
    authInitializerApiRoute={authInitializerApiRoute}
    id="whatever" // this and the two following can be used for customizing styles
    styles="whatever"
    className="whatever"
    />
```

> 💡 If you need to use this button to show it alongside other providers in your custom way, you need it get the providers from next-auth manually and construct them, otherwise just use `ProvidersCard`.

<br>

## **ProvidersCard component**
shows hashpack button alongside the other provers for sign in. good for the case which sign-in through several providers is available. e.g: hashpack and google or ...

```javascript
<ProvidersCard hashconnect={hashconnect}
    pairedAccountId={pairedAccountId}
    hashconnectTopic={hashconnectTopic}
    signInOptions={signInOptions}
    authInitializerApiRoute={authInitializerApiRoute} />
```

> 💡 other providers button have the css class `next-auth-provider-button`, use it to customize their style.

<br>

## **ProvidersCard component**
use this component when you just want a boilerplate default sign-in page.

```javascript
<SignInSection 
    hashconnect={hashconnect!} 
    hashconnectTopic={topic} 
    pairedAccountId={pairingData?.accountIds[0]!}
    signInOptions={signInOptions} 
    authInitializerApiRoute={authInitializerApiRoute}/>
```

# **some notes about configurations**

## changing user structure
by default next-auth user object just have id, name, email and image properties, which among them a string id is mandatory. but if there is case of extending this object, do as follow:

```javascript /pages/api/auth/[...nextAuth].ts
...
    callbacks: {
        async jwt({ token, user, account, profile, isNewUser }: any) {
            if (user?.accountId) {
                // add what ever properties you want to the token
                token.accountId = user?.accountId;
            }
            return token;
        },
        async session({ session, token, user }: any) {
            if (token?.accountId) {
                // add the token properties to the session
                session.user.accountId = token?.accountId;
            }
            return Promise.resolve(session)
        }
    },
...
```

this way, the session in the front contains the user properties you want.


## don't forget the jwt secret

```javascript /pages/api/auth/[...nextAuth].ts
...
    jwt: {
        secret: "a strong phrase"
    }
...
```
