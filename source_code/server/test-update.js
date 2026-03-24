const jwt = require("jsonwebtoken");

async function run() {
  try {
    const loginRes = await fetch(`http://localhost:3000/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "recruiter@acmecorp.example.com", password: "password123" })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;

    const jobId = "cmn0souyq0005si48decnat83";
    
    // Simulate user state from before the fix (description="")
    const form = {
       title: "SDET",
       description: "",
       jobType: "FULL_TIME",
       location: "Bengaluru",
       visibility: "INSTITUTION_SPECIFIC"
    };
    
    console.log("Sending PUT payload with description="":", form);

    const putRes = await fetch(`http://localhost:3000/api/jobs/${jobId}`, {
      method: "PUT",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(form)
    });

    const putData = await putRes.json();
    console.log("Response Status:", putRes.status);
    console.log("Response Body:", putData);

  } catch (err) {
    console.error(err);
  }
}

require('dotenv').config();
run();
