import PublicLayout from "../../layouts/PublicLayout";
import SalonDiscoverySection from "../../components/public/SalonDiscoverySection";
import ServiceChatbot from "../../components/public/ServiceChatbot";

export default function HomePage() {
  return (
    <PublicLayout>
      <SalonDiscoverySection />
      <ServiceChatbot />
    </PublicLayout>
  );
}
