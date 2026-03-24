import { PgBoss } from "pg-boss";
import type { Job } from "pg-boss";
import { env } from "../config/environment";

const JOB_VERIFY_APPLICATION = "verify-application";

let boss: PgBoss | null = null;

export async function initQueue(): Promise<void> {
  boss = new PgBoss(env.DATABASE_URL);

  boss.on("error", (err: unknown) => {
    console.error("[Queue] pg-boss error:", err);
  });

  await boss.start();

  // pg-boss v12: queue must be explicitly created before registering a worker
  await boss.createQueue(JOB_VERIFY_APPLICATION);

  // Lazy import to avoid circular deps at module load time
  const orchestrator = await import("./verification-orchestrator");

  await boss.work<{ applicationId: string }>(
    JOB_VERIFY_APPLICATION,
    async (jobs: Job<{ applicationId: string }>[]) => {
      for (const job of jobs) {
        await orchestrator.verifyApplicationJob(job);
      }
    }
  );

  console.log("[Queue] pg-boss started, worker registered");
}

export async function scheduleVerification(applicationId: string): Promise<void> {
  if (!boss) {
    console.warn("[Queue] pg-boss not initialised — skipping job schedule");
    return;
  }
  // Ensure the queue exists (idempotent — safe to call again)
  await boss.createQueue(JOB_VERIFY_APPLICATION);

  // singletonKey prevents duplicate jobs for the same applicationId
  await boss.send(
    JOB_VERIFY_APPLICATION,
    { applicationId },
    { singletonKey: applicationId, retryLimit: 2, retryDelay: 30 }
  );
}

export async function stopQueue(): Promise<void> {
  if (boss) {
    await boss.stop();
    boss = null;
  }
}
