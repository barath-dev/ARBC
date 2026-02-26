import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { sendSuccess, sendError } from "../utils/api-response";
import { RegisterInput, LoginInput } from "../types";

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
