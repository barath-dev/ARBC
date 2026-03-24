const jwt = require("jsonwebtoken");

async function run() {
  const token = jwt.sign(
    { userId: "cmn0s5vvy0001xe3oy8kjjood", email: "recaccoon@acmecorp.example.com", role: "RECRUITER", name: "Recruiter Account" },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "100y" }
  );
  
  const getRes = await fetch(`http://localhost:3000/api/jobs/mine`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log("GET Response:", await getRes.json());
}

require('dotenv').config();
run();
