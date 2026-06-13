import { NextRequest, NextResponse } from "next/server";

import { DomainError } from "@/lib/errors/domain-error";
import { handleStripeWebhook } from "@/services/payments";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        received: false,
        error: {
          code: "MISSING_STRIPE_SIGNATURE",
          message: "Brakuje naglowka Stripe-Signature.",
        },
      },
      {
        status: 400,
      },
    );
  }

  const payload = await request.text();

  try {
    const result = await handleStripeWebhook(payload, signature);

    return NextResponse.json({
      received: true,
      handled: result.handled,
      eventId: result.eventId,
      eventType: result.eventType,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        {
          received: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: 400,
        },
      );
    }

    console.error("POST /api/webhooks/stripe failed", error);

    return NextResponse.json(
      {
        received: false,
        error: {
          code: "STRIPE_WEBHOOK_FAILED",
          message: "Nie udalo sie obsluzyc webhooka Stripe.",
        },
      },
      {
        status: 500,
      },
    );
  }
}
