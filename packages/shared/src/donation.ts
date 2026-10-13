/** How to donate: shown on the website (/donate) and in the app. Change the details here. */
export const BANK = {
  bank: "Starling Bank",
  rows: [
    { label: "Name", value: "Angeles Maria" },
    { label: "Surname", value: "Alonso Garcia" },
    { label: "Sort code", value: "60-83-71" },
    { label: "Account number", value: "90328542" },
    { label: "Reference", value: "egypt" },
  ],
};

export const PAYPAL_EMAIL = "egyptanimalsos@gmail.com";

/**
 * Where the "Pay with PayPal" button goes. Best is the rescue's PayPal.me link
 * (e.g. "https://paypal.me/egyptanimalsos"), which opens PayPal with the
 * recipient already filled in. Until there is one, it opens PayPal's
 * Send money page, where people paste the email above.
 */
export const PAYPAL_ME_URL: string | null = null;
export const PAYPAL_URL = PAYPAL_ME_URL ?? "https://www.paypal.com/myaccount/transfer/homepage/pay";
