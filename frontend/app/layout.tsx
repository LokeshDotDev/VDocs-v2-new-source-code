import type { Metadata } from "next";
import "@/styles/globals.css";
import AppLayout from "@/components/AppLayout";
import { Providers } from "./providers";

export const metadata: Metadata = {
	title: "VDocs - AI-Powered Document Processing",
	description: "Convert, anonymize, humanize, and format documents with AI",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en'>
			<body className='antialiased dark'>
				<Providers>
					<AppLayout>{children}</AppLayout>
				</Providers>
			</body>
		</html>
	);
}
