import NextAuth, { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    userId?: string;
    email?: string;
    user: DefaultSession["user"];
  }
}
