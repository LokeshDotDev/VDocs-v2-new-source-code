"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "./ui/button";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { data: session } = useSession();
	const [showUserMenu, setShowUserMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowUserMenu(false);
			}
		};

		if (showUserMenu) {
			document.addEventListener("mousedown", handleClickOutside);
			return () => document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [showUserMenu]);

	// Hide navbar/footer on landing page and auth pages
	const hideLayout =
		pathname === "/" ||
		pathname === "/login" ||
		pathname === "/signup" ||
		pathname === "/auth/signin" ||
		pathname === "/auth/signup" ||
		pathname === "/auth/login";

	const isAdmin = session?.user?.role === "admin";

	return (
		<div className='min-h-screen bg-[#05070d] text-slate-100'>
			{!hideLayout && (
				<header className='fixed top-0 w-full border-b border-white/10 backdrop-blur-lg z-50 bg-[#0b1020]/85'>
					<div className='container mx-auto px-6 h-16 flex items-center justify-between'>
						{/* Logo */}
						<Link href='/one-click' className='flex items-center gap-2'>
							<div className='w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 shadow-lg shadow-sky-900/30' />
							<span className='font-bold text-xl bg-gradient-to-r from-sky-300 to-indigo-300 bg-clip-text text-transparent'>
								VDocs
							</span>
						</Link>

						{/* Navigation */}
						<nav className='hidden md:flex items-center gap-8'>
							<Link
								href='/one-click'
								className='text-sm font-medium hover:text-indigo-400 transition-colors'>
								One-Click
							</Link>
							<Link
								href='/convert'
								className='text-sm font-medium hover:text-indigo-400 transition-colors'>
								Converter
							</Link>
							<Link
								href='/reductor'
								className='text-sm font-medium hover:text-indigo-400 transition-colors'>
								Anonymizer
							</Link>
							<Link
								href='/humanizer'
								className='text-sm font-medium hover:text-indigo-400 transition-colors'>
								Humanizer
							</Link>
							<Link
								href='/editor'
								className='text-sm font-medium hover:text-indigo-400 transition-colors'>
								Editor
							</Link>
							{isAdmin && (
								<Link
									href='/admin'
									className='text-sm font-medium hover:text-indigo-400 transition-colors'>
									Admin
								</Link>
							)}
						</nav>

						{/* User Menu */}
						<div className='relative' ref={menuRef}>
							{session?.user ? (
								<div>
									<button
										onClick={() => setShowUserMenu(!showUserMenu)}
										className='flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10 shadow-lg shadow-black/20'>
										<div className='w-8 h-8 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white'>
											<span className='text-sm font-bold'>
												{session.user.name?.charAt(0).toUpperCase() || "U"}
											</span>
										</div>
										<span className='text-sm font-medium'>
											{session.user.name}
										</span>
										<ChevronDown className='w-4 h-4' />
									</button>

									{showUserMenu && (
										<div className='absolute right-0 mt-2 w-56 rounded-lg bg-[#0b1220] border border-white/10 shadow-xl'>
											<div className='p-4 border-b border-white/10'>
												<p className='text-sm font-medium'>{session.user.name}</p>
												<p className='text-xs text-slate-400'>
													{session.user.email}
												</p>
												{isAdmin && (
													<span className='mt-1 inline-block px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-300'>
														Admin
													</span>
												)}
											</div>
											<div className='p-2'>
												<Link
													href='/jobs'
													className='flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors'>
													<User className='w-4 h-4' />
													<span className='text-sm'>My Jobs</span>
												</Link>
												<button
													onClick={() => signOut({ callbackUrl: "/" })}
													className='w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors text-red-400'>
													<LogOut className='w-4 h-4' />
													<span className='text-sm'>Logout</span>
												</button>
											</div>
										</div>
									)}
								</div>
							) : (
								<Link href='/auth/login'>
									<Button className='bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'>
										Login
									</Button>
								</Link>
							)}
						</div>
					</div>
				</header>
			)}

			{/* Main Content */}
			<main className={hideLayout ? "" : "pt-16"}>{children}</main>

			{/* Footer */}
			{!hideLayout && (
				<footer className='border-t border-white/10 bg-[#0a1020]/90 backdrop-blur-lg'>
					<div className='container mx-auto px-6 py-12'>
						<div className='grid md:grid-cols-4 gap-8'>
							{/* Logo & Description */}
							<div>
								<div className='flex items-center gap-2 mb-4'>
									<div className='w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600' />
									<span className='font-bold text-xl bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'>
										VDocs
									</span>
								</div>
								<p className='text-sm text-slate-400'>
									Professional document processing and AI-powered humanization
								</p>
							</div>

							{/* Products */}
							<div>
								<h3 className='font-semibold mb-4'>Products</h3>
								<ul className='space-y-2 text-sm text-slate-400'>
									<li>
										<Link href='/one-click' className='hover:text-indigo-400'>
											One-Click
										</Link>
									</li>
									<li>
										<Link href='/convert' className='hover:text-indigo-400'>
											Converter
										</Link>
									</li>
									<li>
										<Link href='/reductor' className='hover:text-indigo-400'>
											Anonymizer
										</Link>
									</li>
									<li>
										<Link href='/humanizer' className='hover:text-indigo-400'>
											Humanizer
										</Link>
									</li>
								</ul>
							</div>

							{/* Company */}
							<div>
								<h3 className='font-semibold mb-4'>Company</h3>
								<ul className='space-y-2 text-sm text-slate-400'>
									<li>
										<Link href='#' className='hover:text-indigo-400'>
											About
										</Link>
									</li>
									<li>
										<Link href='#' className='hover:text-indigo-400'>
											Careers
										</Link>
									</li>
									<li>
										<Link href='#' className='hover:text-indigo-400'>
											Contact
										</Link>
									</li>
								</ul>
							</div>

							{/* Resources */}
							<div>
								<h3 className='font-semibold mb-4'>Resources</h3>
								<ul className='space-y-2 text-sm text-slate-400'>
									<li>
										<Link href='#' className='hover:text-indigo-400'>
											Documentation
										</Link>
									</li>
									<li>
										<Link href='#' className='hover:text-indigo-400'>
											API Reference
										</Link>
									</li>
									<li>
										<Link href='#' className='hover:text-indigo-400'>
											Support
										</Link>
									</li>
								</ul>
							</div>
						</div>

						<div className='mt-8 pt-8 border-t border-white/10 text-center text-sm text-slate-400'>
							<p>© 2025 VDocs. All rights reserved.</p>
						</div>
					</div>
				</footer>
			)}
		</div>
	);
}
