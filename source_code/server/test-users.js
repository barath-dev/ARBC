const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const users = await prisma.user.findMany();
  console.log("USERS:", users.map(u => ({ id: u.id, email: u.email, role: u.role })));
  
  const students = await prisma.student.findMany();
  console.log("STUDENTS:", students.map(s => ({ id: s.id, userId: s.userId })));
}
test();
