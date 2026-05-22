import "express-session";

declare module "express-session" {
  interface SessionData {
    admin?: boolean;
    userId?: number;
    pendingSignup?: {
      email?: string;
      emailVerified?: boolean;
      phone?: string;
      phoneVerified?: boolean;
      passwordHash?: string;
      passwordSet?: boolean;
    };
    loginEmail?: string;
  }
}
