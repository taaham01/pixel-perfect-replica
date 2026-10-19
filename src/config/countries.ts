/**
 * Countries offered on sign-up and inquiry forms, with the international dialling code and the
 * allowed length of the national number (digits after the country code, no leading 0).
 * Shared codes: +1 (US, Canada, Caribbean), +7 (Russia, Kazakhstan).
 */
export type CountryInfo = { name: string; dial: string; min: number; max: number };

const c = (name: string, dial: string, min: number, max: number = min): CountryInfo => ({ name, dial, min, max });

export const countryData: CountryInfo[] = [
  c("Afghanistan", "93", 9), c("Algeria", "213", 9), c("Angola", "244", 9), c("Argentina", "54", 10, 11),
  c("Armenia", "374", 8), c("Australia", "61", 9), c("Austria", "43", 10, 13), c("Azerbaijan", "994", 9),
  c("Bahamas", "1", 10), c("Bahrain", "973", 8), c("Bangladesh", "880", 10), c("Barbados", "1", 10),
  c("Belgium", "32", 8, 9), c("Bhutan", "975", 8), c("Bolivia", "591", 8), c("Botswana", "267", 7, 8),
  c("Brazil", "55", 10, 11), c("Brunei", "673", 7), c("Bulgaria", "359", 8, 9), c("Cambodia", "855", 8, 9),
  c("Cameroon", "237", 9), c("Canada", "1", 10), c("Chile", "56", 9), c("China", "86", 11),
  c("Colombia", "57", 10), c("Costa Rica", "506", 8), c("Croatia", "385", 8, 9), c("Cuba", "53", 8),
  c("Cyprus", "357", 8), c("Czech Republic", "420", 9), c("Democratic Republic of the Congo", "243", 9),
  c("Denmark", "45", 8), c("Dominican Republic", "1", 10), c("Ecuador", "593", 9), c("Egypt", "20", 10),
  c("Estonia", "372", 7, 8), c("Ethiopia", "251", 9), c("Fiji", "679", 7), c("Finland", "358", 9, 10),
  c("France", "33", 9), c("Georgia", "995", 9), c("Germany", "49", 10, 11), c("Ghana", "233", 9),
  c("Greece", "30", 10), c("Guatemala", "502", 8), c("Guyana", "592", 7), c("Hong Kong", "852", 8),
  c("Hungary", "36", 8, 9), c("Iceland", "354", 7), c("India", "91", 10), c("Indonesia", "62", 9, 12),
  c("Iran", "98", 10), c("Iraq", "964", 10), c("Ireland", "353", 8, 9), c("Israel", "972", 8, 9),
  c("Italy", "39", 9, 11), c("Ivory Coast", "225", 10), c("Jamaica", "1", 10), c("Japan", "81", 9, 10),
  c("Jordan", "962", 8, 9), c("Kazakhstan", "7", 10), c("Kenya", "254", 9), c("Kuwait", "965", 8),
  c("Laos", "856", 8, 10), c("Latvia", "371", 8), c("Lebanon", "961", 7, 8), c("Libya", "218", 9, 10),
  c("Lithuania", "370", 8), c("Luxembourg", "352", 8, 9), c("Madagascar", "261", 9), c("Malawi", "265", 9),
  c("Malaysia", "60", 9, 10), c("Maldives", "960", 7), c("Malta", "356", 8), c("Mauritius", "230", 7, 8),
  c("Mexico", "52", 10), c("Mongolia", "976", 8), c("Morocco", "212", 9), c("Mozambique", "258", 9),
  c("Myanmar", "95", 8, 10), c("Namibia", "264", 9), c("Nepal", "977", 10), c("Netherlands", "31", 9),
  c("New Zealand", "64", 8, 10), c("Nigeria", "234", 10), c("Norway", "47", 8), c("Oman", "968", 8),
  c("Pakistan", "92", 10), c("Palestine", "970", 9), c("Panama", "507", 7, 8), c("Paraguay", "595", 9),
  c("Peru", "51", 9), c("Philippines", "63", 10), c("Poland", "48", 9), c("Portugal", "351", 9),
  c("Qatar", "974", 8), c("Romania", "40", 9), c("Russia", "7", 10), c("Rwanda", "250", 9),
  c("Saudi Arabia", "966", 9), c("Senegal", "221", 9), c("Serbia", "381", 8, 9), c("Singapore", "65", 8),
  c("Slovakia", "421", 9), c("Slovenia", "386", 8), c("Somalia", "252", 7, 9), c("South Africa", "27", 9),
  c("South Korea", "82", 9, 10), c("Spain", "34", 9), c("Sri Lanka", "94", 9), c("Sudan", "249", 9),
  c("Sweden", "46", 9), c("Switzerland", "41", 9), c("Syria", "963", 9), c("Taiwan", "886", 9),
  c("Tanzania", "255", 9), c("Thailand", "66", 9), c("Trinidad and Tobago", "1", 10), c("Tunisia", "216", 8),
  c("Turkey", "90", 10), c("Uganda", "256", 9), c("Ukraine", "380", 9), c("United Arab Emirates", "971", 9),
  c("United Kingdom", "44", 9, 10), c("United States", "1", 10), c("Uruguay", "598", 8),
  c("Uzbekistan", "998", 9), c("Venezuela", "58", 10), c("Vietnam", "84", 9, 10), c("Yemen", "967", 9),
  c("Zambia", "260", 9), c("Zimbabwe", "263", 9),
];

export const countryNames: string[] = [...countryData.map((x) => x.name).sort((a, b) => a.localeCompare(b)), "Other"];

export function dialCodeFor(country: string): string | undefined {
  const d = countryData.find((x) => x.name === country)?.dial;
  return d ? `+${d}` : undefined;
}

/** Returns an error message if the (already normalised, "+digits") number doesn't fit the chosen country, else null. */
export function phoneCountryError(phone: string, country: string): string | null {
  const info = countryData.find((x) => x.name === country);
  if (!info) return null; // "Other": the generic international format check is enough
  const digits = phone.replace(/\D/g, "");
  if (!digits.startsWith(info.dial)) return `A ${country} number must start with +${info.dial}.`;
  const national = digits.slice(info.dial.length);
  if (national.startsWith("0")) return `Remove the leading 0 after +${info.dial}.`;
  if (national.length < info.min || national.length > info.max) {
    const len = info.min === info.max ? `${info.min}` : `${info.min}–${info.max}`;
    return `A ${country} number should have ${len} digits after +${info.dial}.`;
  }
  return null;
}
