const { z } = require("zod");

const createJobSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  skills: z.array(z.string()).default([]),
  location: z.string().optional(),
  isRemote: z.boolean().default(false),
  jobType: z.enum(["INTERNSHIP", "FULL_TIME", "PART_TIME", "CONTRACT"]),
  visibility: z.enum(["PUBLIC", "INSTITUTION_SPECIFIC"]).default("PUBLIC"),
  deadline: z.string().datetime().optional(), // In the backend it's z.iso.datetime() which evaluates to string validation usually
  openPositions: z.coerce.number().int().min(1).default(1),
});

const updateJobSchema = createJobSchema.partial();

const forms = [
  { title: "Test", description: "", jobType: "FULL_TIME", location: "", visibility: "PUBLIC" },
  { title: "Test", description: "a", jobType: "FULL_TIME", location: "", visibility: "PUBLIC" },
  { title: "Test", description: "a", jobType: "FULL_TIME", location: "", visibility: "PUBLIC", isRemote: false, openPositions: 1 },
];

for (const form of forms) {
  const result = updateJobSchema.safeParse(form);
  console.log("Form:", form);
  if (!result.success) {
    console.log("Errors:", result.error.issues);
  } else {
    console.log("Success!");
  }
}
