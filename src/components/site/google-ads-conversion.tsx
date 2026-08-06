import Script from "next/script"

const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "AW-18182187189"
const purchaseConversionLabel =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL ??
  "CKrSCNrs17EcELXR-N1D"

export function GoogleAdsPurchaseConversion({
  currency,
  transactionId,
  valueCents,
}: {
  currency: string | null
  transactionId: string | null
  valueCents: number | null
}) {
  if (!googleAdsId || !purchaseConversionLabel || !transactionId) return null

  const value = valueCents ? Number((valueCents / 100).toFixed(2)) : 1
  const scriptId = `google-ads-purchase-conversion-${transactionId.replace(
    /[^a-zA-Z0-9_-]/g,
    "-"
  )}`

  return (
    <Script id={scriptId} strategy="afterInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
        window.gtag('event', 'conversion', {
          'send_to': '${googleAdsId}/${purchaseConversionLabel}',
          'value': ${JSON.stringify(value)},
          'currency': ${JSON.stringify((currency ?? "EUR").toUpperCase())},
          'transaction_id': ${JSON.stringify(transactionId)}
        });
      `}
    </Script>
  )
}
