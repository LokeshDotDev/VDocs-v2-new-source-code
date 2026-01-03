"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
	Users,
	FileText,
	CheckCircle2,
	XCircle,
	Clock,
	TrendingUp,
	Activity,
	HardDrive,
	Loader2,
} from "lucide-react";

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
	createdAt: string;
	duration?: number;
}

export default function AdminDashboard() {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchDashboardData();
		const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30s
		return () => clearInterval(interval);
	}, []);

	const fetchDashboardData = async () => {
		try {
			const response = await fetch("/api/admin/dashboard");
			const data = await response.json();
			setStats(data.stats);
			setRecentJobs(data.recentJobs);
		} catch (error) {
			console.error("Failed to fetch dashboard data:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className='min-h-screen bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] flex items-center justify-center'>
				<Loader2 className='w-8 h-8 text-indigo-400 animate-spin' />
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100'>
			<div className='mx-auto max-w-7xl px-4 py-16 space-y-8'>
				{/* Header */}
				<div>
					<h1 className='text-4xl font-bold mb-2'>Admin Dashboard</h1>
					<p className='text-slate-400'>
						Monitor system performance and user activity
					</p>
				</div>

				{/* Stats Grid */}
				<div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6'>
					{/* Total Users */}
					<Card className='p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 backdrop-blur'>
						<div className='flex items-center justify-between mb-4'>
							<Users className='w-8 h-8 text-indigo-400' />
							<span className='text-xs font-semibold px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300'>
								+{stats?.activeUsers || 0} active
							</span>
						</div>
						<div>
							<p className='text-3xl font-bold mb-1'>
								{stats?.totalUsers || 0}
							</p>
							<p className='text-sm text-slate-400'>Total Users</p>
						</div>
					</Card>

					{/* Total Jobs */}
					<Card className='p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 backdrop-blur'>
						<div className='flex items-center justify-between mb-4'>
							<FileText className='w-8 h-8 text-blue-400' />
							<span className='text-xs font-semibold px-2 py-1 rounded-full bg-blue-500/20 text-blue-300'>
								{stats?.processingJobs || 0} processing
							</span>
						</div>
						<div>
							<p className='text-3xl font-bold mb-1'>{stats?.totalJobs || 0}</p>
							<p className='text-sm text-slate-400'>Total Jobs</p>
						</div>
					</Card>

					{/* Success Rate */}
					<Card className='p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20 backdrop-blur'>
						<div className='flex items-center justify-between mb-4'>
							<CheckCircle2 className='w-8 h-8 text-green-400' />
							<TrendingUp className='w-5 h-5 text-green-400' />
						</div>
						<div>
							<p className='text-3xl font-bold mb-1'>
								{stats?.successRate?.toFixed(1) || 0}%
							</p>
							<p className='text-sm text-slate-400'>Success Rate</p>
						</div>
					</Card>

					{/* Avg Processing Time */}
					<Card className='p-6 bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20 backdrop-blur'>
						<div className='flex items-center justify-between mb-4'>
							<Clock className='w-8 h-8 text-orange-400' />
							<Activity className='w-5 h-5 text-orange-400' />
						</div>
						<div>
							<p className='text-3xl font-bold mb-1'>
								{stats?.avgProcessingTime?.toFixed(1) || 0}s
							</p>
							<p className='text-sm text-slate-400'>Avg Processing Time</p>
						</div>
					</Card>
				</div>

				{/* Detailed Stats */}
				<div className='grid md:grid-cols-3 gap-6'>
					{/* Completed Jobs */}
					<Card className='p-6 bg-white/5 border-white/10'>
						<div className='flex items-center gap-3 mb-3'>
							<div className='w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center'>
								<CheckCircle2 className='w-5 h-5 text-green-400' />
							</div>
							<div>
								<p className='text-2xl font-bold'>
									{stats?.completedJobs || 0}
								</p>
								<p className='text-sm text-slate-400'>Completed Jobs</p>
							</div>
						</div>
					</Card>

					{/* Failed Jobs */}
					<Card className='p-6 bg-white/5 border-white/10'>
						<div className='flex items-center gap-3 mb-3'>
							<div className='w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center'>
								<XCircle className='w-5 h-5 text-red-400' />
							</div>
							<div>
								<p className='text-2xl font-bold'>{stats?.failedJobs || 0}</p>
								<p className='text-sm text-slate-400'>Failed Jobs</p>
							</div>
						</div>
					</Card>

					{/* Total Storage */}
					<Card className='p-6 bg-white/5 border-white/10'>
						<div className='flex items-center gap-3 mb-3'>
							<div className='w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center'>
								<HardDrive className='w-5 h-5 text-purple-400' />
							</div>
							<div>
								<p className='text-2xl font-bold'>
									{((stats?.totalFileSize || 0) / 1024 / 1024 / 1024).toFixed(
										2
									)}
									GB
								</p>
								<p className='text-sm text-slate-400'>Total Storage</p>
							</div>
						</div>
					</Card>
				</div>

				{/* Recent Jobs */}
				<Card className='p-6 bg-white/5 border-white/10'>
					<h2 className='text-2xl font-bold mb-6'>Recent Jobs</h2>
					<div className='space-y-3'>
						{recentJobs.length > 0 ? (
							recentJobs.map((job) => (
								<div
									key={job.id}
									className='flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-white/10 transition-colors'>
									<div className='flex items-center gap-3'>
										<FileText className='w-5 h-5 text-slate-400' />
										<div>
											<p className='font-medium'>{job.fileName}</p>
											<p className='text-sm text-slate-400'>
												{new Date(job.createdAt).toLocaleString()}
											</p>
										</div>
									</div>
									<div className='flex items-center gap-3'>
										{job.duration && (
											<span className='text-sm text-slate-400'>
												{job.duration}s
											</span>
										)}
										<span
											className={`px-3 py-1 rounded-full text-sm font-semibold ${
												job.status === "completed"
													? "bg-green-500/20 text-green-300"
													: job.status === "failed"
													? "bg-red-500/20 text-red-300"
													: "bg-blue-500/20 text-blue-300"
											}`}>
											{job.status}
										</span>
									</div>
								</div>
							))
						) : (
							<p className='text-center text-slate-400 py-8'>
								No recent jobs
							</p>
						)}
					</div>
				</Card>
			</div>
		</div>
	);
}
