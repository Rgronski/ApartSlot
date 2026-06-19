import type { PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { getResendClient, getResendFromEmail } from "@/integrations/resend/client";

type SendLoggedEmailInput = {
  reservationId?: string | null;
  guestId?: string | null;
  type: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
};

type SendLoggedEmailResult =
  | {
      status: "sent";
      emailLogId: string;
      providerMessageId: string | null;
    }
  | {
      status: "failed";
      emailLogId: string;
      reason: string;
    };

export async function sendLoggedEmail(
  input: SendLoggedEmailInput,
  db: PrismaClient = prisma,
): Promise<SendLoggedEmailResult> {
  const emailLog = await db.emailLog.create({
    data: {
      reservationId: input.reservationId ?? null,
      guestId: input.guestId ?? null,
      type: input.type,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      status: "PENDING",
    },
  });

  try {
    const resend = getResendClient();
    const from = getResendFromEmail();

    const response = await resend.emails.send({
      from,
      to: input.recipientEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (response.error) {
      await db.emailLog.update({
        where: {
          id: emailLog.id,
        },
        data: {
          status: "FAILED",
          errorMessage: response.error.message,
        },
      });

      return {
        status: "failed",
        emailLogId: emailLog.id,
        reason: response.error.message,
      };
    }

    await db.emailLog.update({
      where: {
        id: emailLog.id,
      },
      data: {
        status: "SENT",
        providerMessageId: response.data?.id ?? null,
        sentAt: new Date(),
      },
    });

    return {
      status: "sent",
      emailLogId: emailLog.id,
      providerMessageId: response.data?.id ?? null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udalo sie wyslac automatycznej wiadomosci e-mail.";

    await db.emailLog.update({
      where: {
        id: emailLog.id,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
      },
    });

    return {
      status: "failed",
      emailLogId: emailLog.id,
      reason: message,
    };
  }
}
