import Navbar from "../components/public/Navbar";
import Footer from "../components/public/Footer";

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#FAF6F8] font-[Poppins]">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
