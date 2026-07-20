import PublicLayout from "../../layouts/PublicLayout";
import ProductsSection from "../../components/public/ProductsSection";
import ServicesSection from "../../components/public/ServicesSection";
import AboutSection from "../../components/public/AboutSection";
import ContactSection from "../../components/public/ContactSection";

export default function HomePage() {
  return (
    <PublicLayout>
      <section id="home" className="bg-[#FAF6F8] pt-[104px] pb-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ProductsSection />
          <ServicesSection />
        </div>
      </section>
      <AboutSection />
      <ContactSection />
    </PublicLayout>
  );
}
