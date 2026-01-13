import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
	try {
		const session = await auth();

		// Check if user is admin
		if (!session?.user || session.user.role !== "admin") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		// Fetch stats
		const [
			totalUsers,
			totalJobs,
			completedJobs,
			failedJobs,
			processingJobs,
			recentJobs,
		] = await Promise.all([
			prisma.user.count(),
			prisma.job.count(),
			prisma.job.count({ where: { status: "completed" } }),
			prisma.job.count({ where: { status: "failed" } }),
			prisma.job.count({ where: { status: "processing" } }),
			prisma.job.findMany({
				take: 10,
				orderBy: { createdAt: "desc" },
				include: {
					user: {
						select: { name: true, email: true },
					},
				},
			}),
		]);

		// Calculate active users (users with jobs in last 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		const activeUsers = await prisma.user.count({
			where: {
				jobs: {
					some: {
						createdAt: {
							gte: sevenDaysAgo,
						},
					},
				},
			},
		});

		// Calculate avg processing time
		const completedJobsWithDuration = await prisma.job.findMany({
			where: {
				status: "completed",
				duration: { not: null },
			},
			select: { duration: true },
		});

		interface JobWithDuration {
			duration: number | null;
		}

		const avgProcessingTime =
			completedJobsWithDuration.length > 0
				? completedJobsWithDuration.reduce((sum: number, job: JobWithDuration) => sum + (job.duration || 0), 0) /
				  completedJobsWithDuration.length
				: 0;

		// Calculate total file size
		const fileSizeResult = await prisma.job.aggregate({
			_sum: { fileSize: true },
		});

		const totalFileSize = Number(fileSizeResult._sum.fileSize || 0);

		// Calculate success rate
		const successRate =
			totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

		interface DashboardStats {
			totalUsers: number;
			activeUsers: number;
			totalJobs: number;
			completedJobs: number;
			failedJobs: number;
			processingJobs: number;
			avgProcessingTime: number;
			totalFileSize: number;
			successRate: number;
		}

		interface RecentJob {
			id: string;
			fileName: string;
			status: string;
			createdAt: Date;
			duration: number | null;
		}

		interface DashboardResponse {
			stats: DashboardStats;
			recentJobs: RecentJob[];
		}

		const response: DashboardResponse = {
			stats: {
				totalUsers,
				activeUsers,
				totalJobs,
				completedJobs,
				failedJobs,
				processingJobs,
				avgProcessingTime,
				totalFileSize,
				successRate,
			},
			recentJobs: recentJobs.map((job: typeof recentJobs[0]): RecentJob => ({
				id: job.id,
				fileName: job.fileName,
				status: job.status,
				createdAt: job.createdAt,
				duration: job.duration,
			})),
		};

		return NextResponse.json(response);
	} catch (error) {
		console.error("Dashboard error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch dashboard data" },
			{ status: 500 }
		);
	}
}
