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
      firstName?: string;
      lastName?: string;
      nameSet?: boolean;
      passwordHash?: string;
      passwordSet?: boolean;
      username?: string;
      affiliateRef?: string;
    };
    loginEmail?: string;
    passwordResetEmail?: string;
    passwordResetVerified?: boolean;
  }
}
