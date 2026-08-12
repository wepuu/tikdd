import { z } from "zod";
import { AdminActorSubjectSchema, AdminSchemaVersionSchema, AdminTimestampSchema } from "./common";

export const AdminUsernameSchema = z.string().trim().toLowerCase().min(3).max(64).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);
export const AdminPasswordSchema = z.string().min(8).max(128);
export const AdminLoginRequestSchema = z.strictObject({ username: AdminUsernameSchema, password: AdminPasswordSchema });
export const AdminPasswordChangeRequestSchema = z.strictObject({ currentPassword: AdminPasswordSchema, newPassword: AdminPasswordSchema });
export const AdminLogoutRequestSchema = z.strictObject({ allDevices: z.boolean().default(false) });
export const AdminSessionSchema = z.strictObject({
  schemaVersion: AdminSchemaVersionSchema,
  authenticated: z.literal(true),
  subject: AdminActorSubjectSchema,
  username: AdminUsernameSchema,
  expiresAt: AdminTimestampSchema
});
export const AdminSessionTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const AdminLoginResultSchema = z.strictObject({ session: AdminSessionSchema, sessionToken: AdminSessionTokenSchema });
export const AdminAuthErrorCodeSchema = z.enum(["INVALID_CREDENTIALS", "RATE_LIMITED", "UNAUTHORIZED", "AUTH_UNAVAILABLE", "INVALID_REQUEST"]);

export type AdminSession = z.infer<typeof AdminSessionSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
