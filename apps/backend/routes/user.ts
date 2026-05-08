import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { LoginSchema, SignupSchema } from "@repo/types";
import { prisma } from "@repo/db/client";
import { authMiddleware } from "../utils/authMiddleware";
import { generateRandomToken, SendVerificationEmail } from "../utils/helpers";

const userRouter: Router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

userRouter.post("/signup", async ( req,res ) => {
    const parsedData = SignupSchema.safeParse(req.body);

    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid request body" });
        return;
    }

    const { email, password, name } = parsedData.data;

    try {
        const existingUser = await prisma.user.findFirst({ where: { email } });
        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = generateRandomToken();
        await prisma.user.create({ 
            data: { 
                email: email.toLowerCase(),
                password: hashedPassword,
                name: name,
                verificationToken,
            }
        });

        await SendVerificationEmail(email, verificationToken);
        console.log(`Verification token for ${email}: ${verificationToken}`);

        res.status(200).json({ message: "User created successfully. Please verify your email."});
    } catch (error) {
        console.error("Signup failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

userRouter.post("/verify-email", async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        res.status(400).json({ message: "Email and code are required" });
        return;
    }

    if (typeof email !== "string" || typeof code !== "string") {
        res.status(400).json({ message: "Invalid email or code format" });
        return;
    }

    try {
        const user = await prisma.user.findFirst({ 
            where: { 
                email: email.toLowerCase(),
                verificationToken: code 
            } 
        });

        if (!user) {
            res.status(400).json({ message: "Invalid verification code" });
            return;
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
            },
        });

        const jwttoken = jwt.sign({ userId: user.id, name: user.name }, JWT_SECRET, { expiresIn: "7Days" });
        res.status(200).json({ message: "Email verified successfully", token: jwttoken });
    } catch (error) {
        console.error("Email verification failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

userRouter.post("/resend-verification-email", async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
        res.status(400).json({ message: "Email is required" });
        return;
    }

    try {
        const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
        if (!user) {
            res.status(400).json({ message: "User not found" });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ message: "Email is already verified" });
            return;
        }

        const verificationCode = generateRandomToken();
        await prisma.user.update({
            where: { id: user.id },
            data: { verificationToken: verificationCode },
        });

        await SendVerificationEmail(email, verificationCode);

        res.status(200).json({ message: "Verification code sent successfully" });
    } catch (error) {
        console.error("Resend verification email failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

userRouter.post("/login", async ( req,res ) => {
    const parsedData = LoginSchema.safeParse(req.body);

    if (!parsedData.success) {
        res.status(400).json({ message: "Invalid request body" });
        return;
    }

    const { email, password } = parsedData.data;
    try {
        const user = await prisma.user.findFirst({ where: {
                email : email.toLowerCase(),
            } 
        });
        if (!user || !user.password) {
            res.status(403).json({ message: "Invalid email or password" });
            return;
        }

        // Check if email is verified
        if (!user.isVerified) {
            res.status(403).json({ 
                message: "Email not verified", 
                code: "EMAIL_NOT_VERIFIED",
                email: user.email 
            });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(403).json({ message: "Invalid email or password" });
            return;
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7Days" });
        res.status(200).json({ message: "User logged in successfully", token, name: user.name });
    } catch (error) {
        console.error("Login failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
})

userRouter.get("/me", authMiddleware, async (req, res) => {
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    try {
        const user = await prisma.user.findFirst({
            where: { id: userId, isVerified: true },
            select: {
                name: true,
                email: true,
            },
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            message: "User profile fetched successfully",
            user,
        });
    } catch (error) {
        console.error("Fetch profile failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

userRouter.get("/profile", authMiddleware, async (req, res) => {
    const userId = req.userId;

    if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    try {
        const user = await prisma.user.findFirst({
            where: { id: userId, isVerified: true },
            select: {
                name: true,
                email: true,
                googleId: true,
                githubUsername: true,
                createdAt: true,
                updatedAt: true,
                hostedMeetings: {
                    select: {
                        roomName: true,
                        roomId: true,
                        isHost: true,
                        participants: true,
                    },
                }
            },
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        res.status(200).json({
            user
        });
    } catch (error) {
        console.error("Fetch profile failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

userRouter.post("/update-profile", authMiddleware, async (req, res) => {
    const userId = req.userId;
    const { name } = req.body;

    if (!userId || !name) {
        res.status(403).json({ message: "Missing required fields" });
        return;
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId, isVerified: true },
            data: { 
                name,
                updatedAt: new Date(), 
            },
            select: {
                name: true,
                email: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.status(200).json({
            message: "User profile updated successfully",
            user: updatedUser,
        });
    } catch (error) {
        console.error("Update profile failed:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default userRouter;