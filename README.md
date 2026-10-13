# Pixel Perfect Replica

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/eb73950f-9325-4d61-9c37-8a67439c8779).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Phone verification (SMS codes)

Customers must verify their phone number with a one-time code before they can book a vehicle.
Codes are sent with [Twilio](https://www.twilio.com). Set these as server environment variables
(Lovable Cloud secrets while on Lovable, your hosting panel on Hostinger):

| Variable | What it is |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Account SID from the Twilio console |
| `TWILIO_AUTH_TOKEN` | Auth token from the Twilio console |
| `TWILIO_FROM` | A Twilio phone number (or messaging service sender) that can text your customers' countries |

Until these are set, "Send code" shows an error. A Twilio trial account can only text numbers you have
verified in Twilio, so upgrade it before real customers sign up. The code logic is in
`src/lib/otp.functions.ts`.
