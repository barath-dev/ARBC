import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing existing recruiter accounts...");
  
  // Find all recruiters
  const recruiters = await prisma.user.findMany({
    where: { role: Role.RECRUITER }
  });

  console.log(`Found ${recruiters.length} recruiters. Deleting...`);

  // Delete them (Cascade should handle CompanyMember, but just to be sure)
  for (const recruiter of recruiters) {
    await prisma.user.delete({
       where: { id: recruiter.id }
    });
  }

  console.log("Creating new company...");
  const company = await prisma.company.create({
    data: {
      name: "Acme Corp",
      website: "https://acmecorp.example.com",
    }
  });

  console.log("Creating new recruiter user...");
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({
    data: {
      name: "Recruiter Admin",
      email: "recruiter@acmecorp.example.com",
      password: passwordHash,
      role: Role.RECRUITER,
    }
  });

  console.log("Linking recruiter to company...");
  await prisma.companyMember.create({
    data: {
      userId: user.id,
      companyId: company.id,
    }
  });

  console.log("✅ Done!");
  console.log(`Recruiter Email: recruiter@acmecorp.example.com`);
  console.log(`Recruiter Password: password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
