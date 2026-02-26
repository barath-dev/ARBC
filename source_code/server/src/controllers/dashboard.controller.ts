import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { sendSuccess } from "../utils/api-response";

export async function getDashboardStats(
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const [
            totalStudents,
            totalRequests,
            statusCounts,
            riskLevelCounts
        ] = await Promise.all([
            prisma.student.count(),
            prisma.verificationRequest.count(),
            prisma.verificationRequest.groupBy({
                by: ['status'],
                _count: { id: true }
            }),
            prisma.verificationResult.groupBy({
                by: ['riskLevel'],
                _count: { id: true }
            })
        ]);

        // Format groupBy results into key-value pairs
        const statusMap = statusCounts.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        const riskMap = riskLevelCounts.reduce((acc, curr) => {
            acc[curr.riskLevel] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        sendSuccess(res, {
            stats: {
                totalStudents,
                totalVerifications: totalRequests,
                byStatus: statusMap,
                byRiskLevel: riskMap,
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function getRecentVerifications(
    _req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const recent = await prisma.verificationRequest.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                student: {
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                },
                result: true,
            },
        });

        sendSuccess(res, { recent });
    } catch (error) {
        next(error);
    }
}
