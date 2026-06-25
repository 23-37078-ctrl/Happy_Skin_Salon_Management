import Navbar from "../components/public/Navbar";

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#FAF6F8] font-[Poppins]">
      <Navbar />
      <main>{children}</main>
      <footer className="bg-[#1F2A44] text-white py-6 text-center text-sm">
        <p className="text-gray-400">
          © 2026 Happy Skin Salon Management System. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}