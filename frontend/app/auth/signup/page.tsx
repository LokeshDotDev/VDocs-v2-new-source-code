"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, User, Loader2, ArrowLeft } from "lucide-react";

export default function SignUpPage() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setLoading(false);
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			setLoading(false);
			return;
		}

		try {
			const response = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, email, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Sign up failed");
			} else {
				router.push("/auth/login?registered=true");
			}
		} catch (err) {
			setError("An error occurred. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#050910] via-[#0a1020] to-[#0b1224] text-slate-100 flex items-center justify-center px-4 py-12'>
			{/* Background Effects */}
			<div className='absolute inset-0 overflow-hidden pointer-events-none'>
				<div className='absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl' />
				<div className='absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl' />
			</div>

			<div className='relative w-full max-w-md space-y-8'>
				{/* Back to Home */}
				<Link
					href='/'
					className='inline-flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors'>
					<ArrowLeft className='w-4 h-4' />
					Back to home
				</Link>

				{/* Header */}
				<div className='text-center space-y-2'>
					<div className='flex items-center justify-center gap-2 mb-6'>
						<div className='w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center'>
							<span className='text-white font-bold text-2xl'>V</span>
						</div>
						<span className='text-3xl font-bold'>VDocs</span>
					</div>
					<h1 className='text-3xl font-bold'>Create your account</h1>
					<p className='text-slate-400'>Get started with VDocs today</p>
				</div>

				{/* Sign Up Form */}
				<Card className='p-8 bg-white/5 border-white/10 backdrop-blur-xl'>
					<form onSubmit={handleSubmit} className='space-y-6'>
						{/* Name */}
						<div className='space-y-2'>
							<Label htmlFor='name' className='text-slate-300'>
								Full name
							</Label>
							<div className='relative'>
								<User className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
								<Input
									id='name'
									type='text'
									placeholder='John Doe'
									value={name}
									onChange={(e) => setName(e.target.value)}
									required
									className='pl-10 bg-white/5 border-white/10 focus:border-indigo-500 text-white placeholder:text-slate-500'
								/>
							</div>
						</div>

						{/* Email */}
						<div className='space-y-2'>
							<Label htmlFor='email' className='text-slate-300'>
								Email address
							</Label>
							<div className='relative'>
								<Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
								<Input
									id='email'
									type='email'
									placeholder='you@example.com'
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									required
									className='pl-10 bg-white/5 border-white/10 focus:border-indigo-500 text-white placeholder:text-slate-500'
								/>
							</div>
						</div>

						{/* Password */}
						<div className='space-y-2'>
							<Label htmlFor='password' className='text-slate-300'>
								Password
							</Label>
							<div className='relative'>
								<Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
								<Input
									id='password'
									type='password'
									placeholder='••••••••'
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									className='pl-10 bg-white/5 border-white/10 focus:border-indigo-500 text-white placeholder:text-slate-500'
								/>
							</div>
						</div>

						{/* Confirm Password */}
						<div className='space-y-2'>
							<Label htmlFor='confirmPassword' className='text-slate-300'>
								Confirm password
							</Label>
							<div className='relative'>
								<Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
								<Input
									id='confirmPassword'
									type='password'
									placeholder='••••••••'
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									required
									className='pl-10 bg-white/5 border-white/10 focus:border-indigo-500 text-white placeholder:text-slate-500'
								/>
							</div>
						</div>

						{/* Error Message */}
						{error && (
							<div className='p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm'>
								{error}
							</div>
						)}

						{/* Submit Button */}
						<Button
							type='submit'
							disabled={loading}
							className='w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-6'>
							{loading ? (
								<>
									<Loader2 className='w-5 h-5 mr-2 animate-spin' />
									Creating account...
								</>
							) : (
								"Create account"
							)}
						</Button>

						{/* Terms */}
						<p className='text-xs text-slate-500 text-center'>
							By signing up, you agree to our{" "}
							<a href='#' className='text-indigo-400 hover:text-indigo-300'>
								Terms of Service
							</a>{" "}
							and{" "}
							<a href='#' className='text-indigo-400 hover:text-indigo-300'>
								Privacy Policy
							</a>
						</p>
					</form>
				</Card>

				{/* Sign In Link */}
				<p className='text-center text-slate-400'>
					Already have an account?{" "}
					<Link
						href='/auth/login'
						className='text-indigo-400 hover:text-indigo-300 font-semibold'>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
