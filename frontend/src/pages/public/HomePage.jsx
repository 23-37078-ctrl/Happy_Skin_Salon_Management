import PublicLayout from "../../layouts/PublicLayout";
import SalonDiscoverySection from "../../components/public/SalonDiscoverySection";
import AboutSection from "../../components/public/AboutSection";
import ContactSection from "../../components/public/ContactSection";

export default function HomePage() {
  return (
    <PublicLayout>
      <SalonDiscoverySection />
      <AboutSection />
      <ContactSection />
    </PublicLayout>
  );
}
