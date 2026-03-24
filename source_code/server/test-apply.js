const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

async function test() {
  const job = await prisma.job.findFirst({ where: { status: 'OPEN' } });
  if (!job) { console.log('No open jobs.'); return; }
  
  const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  if (!student) { console.log('No students.'); return; }

  const token = jwt.sign({ userId: student.id, role: student.role }, process.env.JWT_SECRET || 'supersecret');
  console.log(`Token: ${token}`);
  console.log(`JobID: ${job.id}`);
}
test();
