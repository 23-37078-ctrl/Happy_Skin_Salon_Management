import { HiOutlineClock, HiOutlineMapPin, HiStar } from "react-icons/hi2";

export default function BranchCard({
  name,
  image,
  address,
  hoursToday,
  isOpenNow,
  rating,
  distance,
  onView,
  onBookHere,
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#F3E8EF] bg-white shadow-[0_16px_45px_rgba(31,41,55,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_55px_rgba(214,90,154,0.14)]">
      <div className="relative h-44 w-full">
        <img
          src={image || "/images/salon-hero.jpg"}
          alt={name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1F2937]/45 to-transparent" />
        <span
          className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold shadow-sm ${
            isOpenNow ? "bg-[#DCFCE7] text-[#15803D]" : "bg-white text-[#6B7280]"
          }`}
        >
          {isOpenNow ? "Open Now" : "Closed"}
        </span>
        {distance && (
          <span className="absolute bottom-4 left-4 rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-[#1F2937] backdrop-blur">
            {distance}
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-[#1F2937]">{name}</h3>
          {rating && (
            <span className="flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-1 text-sm font-bold text-[#1F2937]">
              <HiStar className="h-4 w-4 text-[#F59E0B]" />
              {rating.toFixed(1)}
            </span>
          )}
        </div>

        <p className="mt-3 flex items-start gap-2 text-sm leading-5 text-[#6B7280]">
          <HiOutlineMapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#D65A9A]" />
          {address}
        </p>

        <p className="mt-2 flex items-center gap-2 text-sm text-[#6B7280]">
          <HiOutlineClock className="h-4 w-4 flex-shrink-0 text-[#D65A9A]" />
          {hoursToday}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onView}
            className="min-h-11 rounded-full border border-[#D65A9A]/25 px-4 py-2.5 text-sm font-bold text-[#1F2937] transition-all duration-300 hover:bg-[#FFF0F7] focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/30"
          >
            View Branch
          </button>
          <button
            onClick={onBookHere}
            className="min-h-11 rounded-full bg-gradient-to-r from-[#D65A9A] to-[#C85B95] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(214,90,154,0.24)] transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#D65A9A]/35"
          >
            Book Here
          </button>
        </div>
      </div>
    </article>
  );
}
