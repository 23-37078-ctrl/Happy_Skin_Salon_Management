import PublicLayout from "../../layouts/PublicLayout";
import HeroSection from "../../components/public/HeroSection";
import ProductsSection from "../../components/public/ProductsSection";
import ServicesSection from "../../components/public/ServicesSection";
import AboutSection from "../../components/public/AboutSection";
import ContactSection from "../../components/public/ContactSection";

export default function HomePage() {
  return (
    <PublicLayout>
      <HeroSection />
      <ProductsSection />
      <ServicesSection />
      <AboutSection />
      <ContactSection />
    </PublicLayout>
  );
}