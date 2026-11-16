import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@altereffects/db";
import { hit, ipFrom } from "./ratelimit";

class TooManyAttempts extends CredentialsSignin { code = "rate_limited"; }

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2a$10$Cl9lTJGbOCNVG/OQEmJome9/CxKW2kLJ5OR.EVxGEutZd2NIeHFDu";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // Rate limits live here (not only in the login form's action) so the raw /api/auth endpoint is covered too.
      async authorize(c, request) {
        const email = String(c?.email ?? "").toLowerCase().trim();
        const ip = ipFrom(request.headers);
        const rules: Array<[string, number, number]> = [[`login:email:${email}`, 10, 900]];
        if (ip) rules.push([`login:ip:${ip}`, 30, 900]);
        for (const [key, max, win] of rules) if (!(await hit(key, max, win)).ok) throw new TooManyAttempts();
        const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
        const ok = await bcrypt.compare(String(c?.password ?? ""), user?.passwordHash ?? DUMMY_HASH);
        if (!user || !ok) return null;
        return { id: user.id, email: user.email, name: user.name, pwdAt: user.passwordChangedAt?.getTime() ?? 0 } as any;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) { if (user) { token.uid = user.id; token.pwdAt = (user as any).pwdAt ?? 0; } return token; },
    session({ session, token }) { if (token.uid) { (session.user as any).id = token.uid; (session.user as any).pwdAt = token.pwdAt ?? 0; } return session; },
  },
});
