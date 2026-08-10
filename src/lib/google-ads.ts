const verifiedGoogleAdsId = "AW-18182187189"
const verifiedPurchaseConversionLabel = "CKrSCNrs17EcELXR-N1D"
const verifiedAccountCreatedConversionLabel = "o60NCISN694cELXR-N1D"
const verifiedBlueprintUploadStartedConversionLabel = "2NvSCIqN694cELXR-N1D"
const verifiedCheckoutStartedConversionLabel = "uoDlCIeN694cELXR-N1D"

const googleAdsIdPattern = /^AW-\d{6,20}$/
const conversionLabelPattern = /^[A-Za-z0-9_-]{6,100}$/

function configuredValue(value: string | undefined, fallback: string) {
  const normalized = value?.trim() || fallback
  return normalized
}

export const googleAdsId = configuredValue(
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  verifiedGoogleAdsId
)

export const googleAdsPurchaseConversionLabel = configuredValue(
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_CONVERSION_LABEL,
  verifiedPurchaseConversionLabel
)

export const googleAdsConfigurationIsValid =
  googleAdsIdPattern.test(googleAdsId) &&
  conversionLabelPattern.test(googleAdsPurchaseConversionLabel)

export const googleAdsPurchaseDestination = googleAdsConfigurationIsValid
  ? `${googleAdsId}/${googleAdsPurchaseConversionLabel}`
  : null

export const googleAdsAccountCreatedDestination = conversionDestination(
  configuredValue(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ACCOUNT_CREATED_CONVERSION_LABEL,
    verifiedAccountCreatedConversionLabel
  )
)

export const googleAdsBlueprintUploadStartedDestination = conversionDestination(
  configuredValue(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_BLUEPRINT_UPLOAD_STARTED_CONVERSION_LABEL,
    verifiedBlueprintUploadStartedConversionLabel
  )
)

export const googleAdsCheckoutStartedDestination = conversionDestination(
  configuredValue(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CHECKOUT_STARTED_CONVERSION_LABEL,
    verifiedCheckoutStartedConversionLabel
  )
)

function conversionDestination(label: string | undefined) {
  const normalized = label?.trim() ?? ""
  return googleAdsIdPattern.test(googleAdsId) &&
    conversionLabelPattern.test(normalized)
    ? `${googleAdsId}/${normalized}`
    : null
}
