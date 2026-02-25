import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Providers>
            <Navbar />
            <main style={{ minHeight: "100vh", paddingTop: 72 }}>{children}</main>
            <Footer />
        </Providers>
    );
}
