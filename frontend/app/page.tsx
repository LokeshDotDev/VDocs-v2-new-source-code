"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	FileText,
	Zap,
	Shield,
	Sparkles,
	CheckCircle2,
	ArrowRight,
	Upload,
	RefreshCw,
	FileCheck,
	Download,
	TrendingUp,
	Users,
	Clock,
	Target,
} from "lucide-react";

export default function Home() {
	const [stats, setStats] = useState({
		documentsProcessed: 0,
		aiDetections: 0,
		timesSaved: 0,
		accuracyRate: 0,
	});

	// Animate stats on mount
	useEffect(() => {
		const duration = 2000;
		const steps = 60;
		const interval = duration / steps;

		let step = 0;
		const timer = setInterval(() => {
			step++;
			const progress = step / steps;

			setStats({
				documentsProcessed: Math.floor(15420 * progress),
				aiDetections: Math.floor(8750 * progress),
				timesSaved: Math.floor(2340 * progress),
				accuracyRate: Math.floor(98.5 * progress),
			});

			if (step >= steps) clearInterval(timer);
		}, interval);

		return () => clearInterval(timer);
	}, []);

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100'>
			{/* Hero Section */}
			<section className='relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8'>
				{/* Background gradients */}
				<div className='absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 blur-3xl' />
				<div className='absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse' />
				<div className='absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000' />

				<div className='relative mx-auto max-w-7xl'>
					<div className='text-center space-y-8'>
						<div className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm'>
							<Sparkles className='w-4 h-4' />
							<span>AI-Powered Document Processing</span>
						</div>

						<h1 className='text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight'>
							Transform Your Documents
							<br />
							<span className='bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent'>
								With AI Precision
							</span>
						</h1>

						<p className='mx-auto max-w-2xl text-xl text-slate-300'>
							Anonymize, humanize, and perfect your documents in seconds. Our
							AI-powered pipeline handles everything from PDF conversion to
							professional formatting.
						</p>

						<div className='flex flex-wrap items-center justify-center gap-4'>
							<Link href='/one-click'>
								<Button size='lg' className='gap-2 text-lg h-14 px-8'>
									<Zap className='w-5 h-5' />
									Start Processing
									<ArrowRight className='w-5 h-5' />
								</Button>
							</Link>
							<Link href='/editor'>
								<Button
									size='lg'
									variant='outline'
									className='gap-2 text-lg h-14 px-8'>
									<FileText className='w-5 h-5' />
									Try Editor
								</Button>
							</Link>
						</div>

						{/* Stats */}
						<div className='grid grid-cols-2 md:grid-cols-4 gap-6 pt-12'>
							<Card className='p-6 bg-white/5 backdrop-blur border-white/10'>
								<div className='flex items-center justify-center gap-3 mb-2'>
									<FileCheck className='w-6 h-6 text-indigo-400' />
									<span className='text-3xl font-bold'>
										{stats.documentsProcessed.toLocaleString()}+
									</span>
								</div>
								<p className='text-sm text-slate-400'>Documents Processed</p>
							</Card>

							<Card className='p-6 bg-white/5 backdrop-blur border-white/10'>
								<div className='flex items-center justify-center gap-3 mb-2'>
									<Target className='w-6 h-6 text-purple-400' />
									<span className='text-3xl font-bold'>
										{stats.aiDetections.toLocaleString()}+
									</span>
								</div>
								<p className='text-sm text-slate-400'>AI Detections</p>
							</Card>

							<Card className='p-6 bg-white/5 backdrop-blur border-white/10'>
								<div className='flex items-center justify-center gap-3 mb-2'>
									<Clock className='w-6 h-6 text-pink-400' />
									<span className='text-3xl font-bold'>
										{stats.timesSaved.toLocaleString()}+
									</span>
								</div>
								<p className='text-sm text-slate-400'>Hours Saved</p>
							</Card>

							<Card className='p-6 bg-white/5 backdrop-blur border-white/10'>
								<div className='flex items-center justify-center gap-3 mb-2'>
									<TrendingUp className='w-6 h-6 text-green-400' />
									<span className='text-3xl font-bold'>{stats.accuracyRate}%</span>
								</div>
								<p className='text-sm text-slate-400'>Accuracy Rate</p>
							</Card>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section className='px-4 py-20 sm:px-6 lg:px-8'>
				<div className='mx-auto max-w-7xl'>
					<div className='text-center mb-16'>
						<h2 className='text-4xl font-bold mb-4'>
							Powerful Features for Modern Workflows
						</h2>
						<p className='text-xl text-slate-400 max-w-2xl mx-auto'>
							Everything you need to process, edit, and perfect your documents
							in one seamless platform
						</p>
					</div>

					<div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
						{/* Feature 1 */}
						<Card className='p-8 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20 backdrop-blur hover:scale-105 transition-transform duration-300'>
							<div className='w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-6'>
								<Zap className='w-6 h-6 text-indigo-400' />
							</div>
							<h3 className='text-xl font-semibold mb-3'>
								One-Click Processing
							</h3>
							<p className='text-slate-400 mb-4'>
								Upload your files and let our AI pipeline handle everything:
								conversion, anonymization, humanization, and formatting.
							</p>
							<Link href='/one-click'>
								<Button variant='ghost' className='gap-2 p-0 h-auto'>
									Try it now <ArrowRight className='w-4 h-4' />
								</Button>
							</Link>
						</Card>

						{/* Feature 2 */}
						<Card className='p-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 backdrop-blur hover:scale-105 transition-transform duration-300'>
							<div className='w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6'>
								<Shield className='w-6 h-6 text-purple-400' />
							</div>
							<h3 className='text-xl font-semibold mb-3'>
								Smart Anonymization
							</h3>
							<p className='text-slate-400 mb-4'>
								Automatically detect and redact names, roll numbers, and
								sensitive information while preserving document structure.
							</p>
							<Link href='/reductor'>
								<Button variant='ghost' className='gap-2 p-0 h-auto'>
									Learn more <ArrowRight className='w-4 h-4' />
								</Button>
							</Link>
						</Card>

						{/* Feature 3 */}
						<Card className='p-8 bg-gradient-to-br from-pink-500/10 to-orange-500/10 border-pink-500/20 backdrop-blur hover:scale-105 transition-transform duration-300'>
							<div className='w-12 h-12 rounded-lg bg-pink-500/20 flex items-center justify-center mb-6'>
								<Sparkles className='w-6 h-6 text-pink-400' />
							</div>
							<h3 className='text-xl font-semibold mb-3'>AI Humanization</h3>
							<p className='text-slate-400 mb-4'>
								Make AI-generated text sound natural and human-written with our
								advanced humanization algorithms.
							</p>
							<Link href='/humanizer'>
								<Button variant='ghost' className='gap-2 p-0 h-auto'>
									Explore <ArrowRight className='w-4 h-4' />
								</Button>
							</Link>
						</Card>

						{/* Feature 4 */}
						<Card className='p-8 bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20 backdrop-blur hover:scale-105 transition-transform duration-300'>
							<div className='w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-6'>
								<FileText className='w-6 h-6 text-green-400' />
							</div>
							<h3 className='text-xl font-semibold mb-3'>Online Editor</h3>
							<p className='text-slate-400 mb-4'>
								Edit DOCX files directly in your browser with our
								OnlyOffice-powered editor. No downloads required.
							</p>
							<Link href='/editor'>
								<Button variant='ghost' className='gap-2 p-0 h-auto'>
									Open editor <ArrowRight className='w-4 h-4' />
								</Button>
							</Link>
						</Card>

						{/* Feature 5 */}
						<Card className='p-8 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 backdrop-blur hover:scale-105 transition-transform duration-300'>
							<div className='w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-6'>
								<RefreshCw className='w-6 h-6 text-blue-400' />
							</div>
						<h3 className='text-xl font-semibold mb-3'>Universal Converter</h3>
						<p className='text-slate-400 mb-4'>
							Convert between 100+ file formats - documents, images, videos,
							and audio files instantly.
						</p>
						<Link href='/universal-convert'>
						<Button variant='ghost' className='gap-2 p-0 h-auto'>
							Convert now <ArrowRight className='w-4 h-4' />
						</Button>
					</Link>
				</Card>

				{/* Feature 6 */}
				<Card className='p-8 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 backdrop-blur hover:scale-105 transition-transform duration-300'>
					<div className='w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-6'>
						<CheckCircle2 className='w-6 h-6 text-orange-400' />
					</div>
					<h3 className='text-xl font-semibold mb-3'>
						Professional Formatting
					</h3>
					<p className='text-slate-400 mb-4'>
						Apply standard formatting automatically: Times New Roman, 12pt,
						justified text, and proper margins.
					</p>
				</Card>
					</div>
				</div>
			</section>

			{/* How It Works */}
			<section className='px-4 py-20 sm:px-6 lg:px-8 bg-white/5'>
				<div className='mx-auto max-w-7xl'>
					<div className='text-center mb-16'>
						<h2 className='text-4xl font-bold mb-4'>How It Works</h2>
						<p className='text-xl text-slate-400 max-w-2xl mx-auto'>
							Our AI-powered pipeline processes your documents in 6 simple steps
						</p>
					</div>

					<div className='grid md:grid-cols-3 lg:grid-cols-6 gap-6'>
						{[
							{ icon: Upload, title: "Upload", desc: "PDF or DOCX" },
							{ icon: RefreshCw, title: "Convert", desc: "PDF to DOCX" },
							{ icon: Shield, title: "Anonymize", desc: "Remove PII" },
							{ icon: Sparkles, title: "Humanize", desc: "Natural text" },
							{ icon: CheckCircle2, title: "Format", desc: "Professional" },
							{ icon: Download, title: "Download", desc: "Get ZIP" },
						].map((step, idx) => (
							<Card
								key={idx}
								className='p-6 bg-white/5 backdrop-blur border-white/10 text-center'>
								<div className='w-12 h-12 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center mb-4'>
									<step.icon className='w-6 h-6 text-indigo-400' />
								</div>
								<div className='text-2xl font-bold text-indigo-400 mb-2'>
									{idx + 1}
								</div>
								<h3 className='font-semibold mb-1'>{step.title}</h3>
								<p className='text-sm text-slate-400'>{step.desc}</p>
							</Card>
						))}
					</div>

					<div className='text-center mt-12'>
						<Link href='/one-click'>
							<Button size='lg' className='gap-2'>
								<Zap className='w-5 h-5' />
								Start Processing Now
							</Button>
						</Link>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className='px-4 py-20 sm:px-6 lg:px-8'>
				<div className='mx-auto max-w-4xl'>
					<Card className='p-12 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-indigo-500/20 backdrop-blur text-center'>
						<h2 className='text-4xl font-bold mb-4'>
							Ready to Transform Your Documents?
						</h2>
						<p className='text-xl text-slate-300 mb-8'>
							Join thousands of users who trust our AI-powered document
							processing platform
						</p>
						<div className='flex flex-wrap items-center justify-center gap-4'>
							<Link href='/one-click'>
								<Button size='lg' className='gap-2'>
									<Zap className='w-5 h-5' />
									Get Started Free
								</Button>
							</Link>
							<Link href='/editor'>
								<Button size='lg' variant='outline' className='gap-2'>
									<FileText className='w-5 h-5' />
									Try Editor
								</Button>
							</Link>
						</div>
					</Card>
				</div>
			</section>
		</div>
	);
}
