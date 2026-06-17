import { NextRequest, NextResponse } from "next/server";

import { DomainError } from "@/lib/errors/domain-error";
import { createStripeCheckoutSession } from "@/services/payments";

function mapErrorToRedirectMessage(error: DomainError) {
  switch (error.code) {
    case "PAYMENT_NOT_FOUND":
      return "not_found";
    case "PAYMENT_ALREADY_COMPLETED":
      return "paid";
    case "PAYMENT_CANCELLED":
      return "cancelled";
    case "PAYMENT_EXPIRED":
      return "expired";
    case "MISSING_STRIPE_SECRET_KEY":
      return "stripe_not_configured";
    case "MISSING_APP_BASE_URL":
      return "app_url_missing";
    default:
      return "error";
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  try {
    const result = await createStripeCheckoutSession(token);

    return NextResponse.redirect(result.checkoutUrl, {
      status: 303,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const redirectUrl = new URL(`/pay/${token}`, request.url);
      redirectUrl.searchParams.set("checkout", mapErrorToRedirectMessage(error));

      return NextResponse.redirect(redirectUrl, {
        status: 303,
      });
    }

    console.error("POST /pay/[token]/checkout failed", error);

    const redirectUrl = new URL(`/pay/${token}`, request.url);
    redirectUrl.searchParams.set("checkout", "error");

    return NextResponse.redirect(redirectUrl, {
      status: 303,
    });
  }
}
