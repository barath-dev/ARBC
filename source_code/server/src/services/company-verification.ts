export interface VerificationContext {
    studentId: string;
    requestId: string;
}

export interface CompanyVerificationResult {
    verified: boolean | null;
    responseReceived: boolean;
    notes: string;
}

/**
 * STUB: Company Verification Service
 * In a real implementation, this would send an email via SendGrid/SMTP
 * and provide a webhook or magic link for recruiters to confirm employment.
 */
export class CompanyVerificationService {
    public async verifyEmployment(
        _context: VerificationContext,
        company: string,
        role: string | undefined
    ): Promise<CompanyVerificationResult> {
        console.log(`[STUB] Simulating email verification to ${company} for role ${role}`);

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // STUB LOGIC: 
        // Return a random response to simulate the real-world where 
        // some companies respond and some don't.
        const random = Math.random();

        if (random > 0.7) {
            return { verified: true, responseReceived: true, notes: "HR confirmed employment dates matching resume." };
        } else if (random > 0.4) {
            return { verified: false, responseReceived: true, notes: "Candidate never worked here." };
        } else {
            return { verified: null, responseReceived: false, notes: "Pending HR response." };
        }
    }
}

export const companyVerifier = new CompanyVerificationService();
