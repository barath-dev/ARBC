import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { sendSuccess, sendError } from "../utils/api-response";
import { RegisterInput, LoginInput } from "../types";
import { env } from "../config/environment";
import { encryptToken } from "../utils/github-token-crypto";

export async function register(
  req: Request<{}, {}, RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, name, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      sendError(res, "Email already in use", 409, "EMAIL_IN_USE");
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role,
        },
      });

      // Automatically create a Student profile if the role is STUDENT
      if (role === "STUDENT") {
        await tx.student.create({
          data: {
            userId: newUser.id,
          },
        });
      }

      return newUser;
    });

    const token = generateToken({ userId: user.id, role: user.role });

    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request<{}, {}, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      sendError(res, "Invalid credentials", 401, "INVALID_CREDENTIALS");
      return;
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      sendError(res, "Invalid credentials", 401, "INVALID_CREDENTIALS");
      return;
    }

    const token = generateToken({ userId: user.id, role: user.role });

    sendSuccess(res, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      sendError(res, "User not found", 404, "USER_NOT_FOUND");
      return;
    }

    sendSuccess(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function githubOAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId; // Passed from requireAuth middleware

    if (!env.GH_CLIENT_ID) {
      sendError(res, "GitHub Client ID not configured", 500, "CONFIG_ERROR");
      return;
    }

    // We pass the JWT token in the 'state' parameter to persist the user session across the OAuth flow.
    // In production, you might want to sign/encrypt this state or use a short-lived token.
    const state = req.headers.authorization?.split(" ")[1] || "";
    
    // Explicitly pass the local redirect URI so GitHub returns to localhost instead of the production Vercel URL
    const redirectUri = "http://localhost:3000/api/auth/github/callback";
    // Request 'repo' scope for full private repository access during analysis.
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GH_CLIENT_ID}&scope=repo%2Cread%3Auser&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&prompt=consent`;

    sendSuccess(res, { url: githubAuthUrl });
  } catch (error) {
    next(error);
  }
}

export async function githubOAuthCallback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { code, state: token } = req.query;

    if (!code || typeof code !== "string" || !token || typeof token !== "string") {
      res.redirect("http://localhost:3001/status?error=invalid_oauth_callback");
      return;
    }

    // Since token is passed in state, we verify it here
    let userId: string;
    let role: string;
    try {
      const { verifyToken } = require("../utils/jwt");
      const payload = verifyToken(token);
      userId = payload.userId;
      role = payload.role;
    } catch (err) {
      res.redirect("http://localhost:3001/status?error=invalid_state_token");
      return;
    }

    if (role !== "STUDENT") {
      res.redirect("http://localhost:3001/status?error=unauthorized_role");
      return;
    }

    if (!env.GH_CLIENT_ID || !env.GH_CLIENT_SECRET) {
      res.redirect("http://localhost:3001/status?error=server_misconfiguration");
      return;
    }

    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: env.GH_CLIENT_ID,
        client_secret: env.GH_CLIENT_SECRET,
        code,
        redirect_uri: "http://localhost:3000/api/auth/github/callback",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to exchange token, status: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      res.redirect("http://localhost:3001/status?error=github_token_exchange_failed");
      return;
    }

    // 2. Fetch the user's GitHub profile
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${accessToken}`,
        "User-Agent": "ARBC-Server",
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user profile, status: ${userResponse.status}`);
    }

    const userData = await userResponse.json();
    const githubUsername = userData.login;

    if (!githubUsername) {
      res.redirect("http://localhost:3001/status?error=github_profile_fetch_failed");
      return;
    }

    // 3. Update the student record with username AND store the encrypted access token for future API calls
    const tokenToStore = env.GH_TOKEN_ENCRYPTION_KEY
        ? encryptToken(accessToken)
        : accessToken; // fallback to plaintext if no encryption key configured (dev only)

    await prisma.student.update({
      where: { userId },
      data: { githubUsername, githubAccessToken: tokenToStore },
    });

    // 4. Redirect the user back to the student portal success page or dashboard
    res.redirect(`http://localhost:3001/?github_connected=true&token=${token}`);
  } catch (error) {
    console.error("GitHub OAuth Callback Error:", error);
    res.redirect("http://localhost:3001/status?error=oauth_processing_failed");
  }
}
