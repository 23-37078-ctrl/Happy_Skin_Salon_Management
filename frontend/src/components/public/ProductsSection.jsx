import { useNavigate } from "react-router-dom";
import { SALON_PACKAGES, formatServicePrice } from "../../constants/salonServices";
import { useAuth } from "../../hooks/useAuth";

export default function ProductsSection() {
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useAuth();

  const handleBook = (packageId) => {
    const bookingPath = `/customer/book?service=${packageId}`;
    if (isAuthenticated && currentUser?.role === "customer") {
      navigate(bookingPath);
      return;
    }
    navigate(`/login?redirect=${encodeURIComponent(bookingPath)}`);
  };

  return (
    <section id="products" className="bg-white rounded-3xl border border-[#F0E6EC] p-5 lg:p-6 shadow-sm">
      <div className="mb-5">
        <span className="text-[#C85B95] text-xs font-bold uppercase tracking-[0.18em]">
          Products
        </span>
        <h1 className="text-2xl font-extrabold text-[#1F2A44] mt-1">
          Beauty packages made for you
        </h1>
        <p className="text-[#6B7280] text-xs leading-relaxed mt-1.5">
          Choose a complete beauty package and book your visit in a few clicks.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SALON_PACKAGES.map((product) => (
          <article
            key={product.name}
            className="group bg-[#FAF6F8] border border-[#F0E6EC] rounded-2xl p-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex gap-3">
              <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-pink-100">
                <img
                  src={product.img}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block px-2 py-0.5 rounded-full bg-white text-[#C85B95] text-[8px] font-bold uppercase tracking-wide">
                  {product.tag}
                </span>
                <h2 className="text-xs font-bold text-[#1F2A44] mt-1 leading-snug line-clamp-2">
                  {product.name}
                </h2>
                <p className="text-[10px] text-[#6B7280] mt-1 line-clamp-1">
                  {product.description}
                </p>
                <p className="text-[#C85B95] font-extrabold text-xs mt-1">
                  {formatServicePrice(product.price)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleBook(product.id)}
              className="w-full mt-2 py-1.5 rounded-lg bg-white text-[#C85B95] text-[11px] font-semibold border border-pink-100 hover:bg-[#C85B95] hover:text-white transition-all duration-200"
            >
              Book Package
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
