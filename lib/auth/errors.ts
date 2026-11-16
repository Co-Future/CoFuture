/** Maps Supabase Auth error codes to messages for the user (German UI text). */
export function authErrorMessage(error: { code?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-Mail-Adresse oder Passwort stimmen nicht.";
    case "user_already_exists":
    case "email_exists":
      return "Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich an.";
    case "weak_password":
      return "Das Passwort ist zu schwach. Wähle ein längeres.";
    case "email_address_invalid":
      return "Diese E-Mail-Adresse wird nicht angenommen.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Zu viele Versuche. Warte kurz und versuch es noch einmal.";
    case "signup_disabled":
      return "Die Registrierung ist gerade abgeschaltet.";
    default:
      return "Das hat nicht geklappt. Versuch es noch einmal.";
  }
}
