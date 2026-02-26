import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash("password123", 10);

    const recruiter = await prisma.user.upsert({
        where: { email: "recruiter@arbc.com" },
        update: {},
        create: {
            email: "recruiter@arbc.com",
            password: hashedPassword,
            name: "Admin Recruiter",
            role: Role.RECRUITER,
        },
    });

    console.log("✅ Seeded Recruiter account:");
    console.log(`Email: ${recruiter.email}`);
    console.log(`Password: password123`);
    console.log(`Role: ${recruiter.role}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
