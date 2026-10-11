import Navbar from "../components/public/Navbar";
import Footer from "../components/public/Footer";

export default function PublicLayout({ children }) {
  return (
    <div data-theme="light" className="light-experience portal-page min-h-screen bg-[#FAF6F8] font-[Poppins]">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
