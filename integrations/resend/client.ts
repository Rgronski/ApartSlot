import { Resend } from "resend";

import { DomainError } from "@/lib/errors/domain-error";

let resendClient: Resend | null = null;

export function getResendClient() {
  if (resendClient) {
    return resendClient;
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    throw new DomainError(
      "MISSING_RESEND_API_KEY",
      "Brakuje klucza RESEND_API_KEY.",
    );
  }

  resendClient = new Resend(resendApiKey);
  return resendClient;
}

export function getResendFromEmail() {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();

  if (!fromEmail) {
    throw new DomainError(
      "MISSING_RESEND_FROM_EMAIL",
      "Brakuje adresu RESEND_FROM_EMAIL.",
    );
  }

  return fromEmail;
}
