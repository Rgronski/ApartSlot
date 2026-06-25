import { NextRequest, NextResponse } from "next/server";

import { DomainError } from "@/lib/errors/domain-error";
import { handleMollieWebhook } from "@/services/payments";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const molliePaymentId = String(formData.get("id") ?? "").trim();

  if (!molliePaymentId) {
    return NextResponse.json({
      received: true,
      handled: false,
      message: "Brakuje ID platnosci Mollie.",
    });
  }

  try {
    const result = await handleMollieWebhook(molliePaymentId);

    return NextResponse.json({
      received: true,
      handled: result.handled,
      paymentId: result.paymentId,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof DomainError) {
      console.error("POST /api/webhooks/mollie failed", {
        code: error.code,
        message: error.message,
      });

      return NextResponse.json(
        {
          received: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        {
          status: 500,
        },
      );
    }

    console.error("POST /api/webhooks/mollie failed", error);

    return NextResponse.json(
      {
        received: false,
        error: {
          code: "MOLLIE_WEBHOOK_FAILED",
          message: "Nie udalo sie obsluzyc webhooka Mollie.",
        },
      },
      {
        status: 500,
      },
    );
  }
}
