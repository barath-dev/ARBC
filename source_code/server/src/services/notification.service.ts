import nodemailer from "nodemailer";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { env } from "../config/environment";

// ─── Notification types ───────────────────────────────────

export const NotificationType = {
  BOARD_REQUEST: "BOARD_REQUEST",
  BOARD_APPROVED: "BOARD_APPROVED",
  BOARD_REJECTED: "BOARD_REJECTED",
  APPLICATION_RECEIVED: "APPLICATION_RECEIVED",
  STATUS_CHANGED: "STATUS_CHANGED",
} as const;

export type NotificationTypeValue = typeof NotificationType[keyof typeof NotificationType];

// Set of types that also trigger email
const EMAIL_TYPES: ReadonlySet<string> = new Set<string>([
  NotificationType.APPLICATION_RECEIVED,
  NotificationType.STATUS_CHANGED,
]);

// ─── Mailer (lazy) ────────────────────────────────────────

function createTransporter() {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
}

// ─── Public API ───────────────────────────────────────────

export async function notify(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      metadata: metadata !== undefined
        ? (metadata as Prisma.InputJsonValue)
        : undefined,
    },
  });
}

export async function notifyWithEmail(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await notify(userId, type, title, body, metadata);

  if (!EMAIL_TYPES.has(type) || !env.SMTP_HOST) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return;

  const transporter = createTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: user.email,
      subject: title,
      text: body,
      html: `<p>${body}</p><br><small><a href="${env.APP_URL}">Open Portal</a></small>`,
    });
  } catch (err) {
    // Email is best-effort — never block main flow
    console.warn("[Notifications] Email send failed:", err);
  }
}
