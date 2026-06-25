import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineBanknotes,
  HiOutlineCalendarDays,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineClipboardDocumentCheck,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from "react-icons/hi2";
import staffBookingService from "../../services/staffBookingService";
import staffTransactionService from "../../services/staffTransactionService";
import {
  CardSkeleton,
  EmptyState,
  ErrorNotice,
  StaffWorkspace,
  StatCard,
  StatusBadge,
} from "./StaffWorkspace";
import {
  formatCurrency,
  formatDateTime,
  getApiError,
} from "./staffWorkspaceUtils";

export default function StaffDashboard() {
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [bookingData, transactionData] = await Promise.all([
        staffBookingService.list({ page: 1, page_size: 8 }),
        staffTransactionService.list({ page: 1, page_size: 5 }),
      ]);
      setBookings(bookingData.bookings || []);
      setTransactions(transactionData.transactions || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load the staff dashboard."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadDashboard());
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayBookings = bookings.filter((booking) => new Date(booking.appointment_date).toDateString() === today);
    const openBookings = bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status));
    const todayRevenue = transactions
      .filter((transaction) => new Date(transaction.created_at).toDateString() === today)
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

    return [
      { label: "Today's Appointments", value: todayBookings.length, icon: HiOutlineCalendarDays, tone: "pink" },
      { label: "Open Queue", value: openBookings.length, icon: HiOutlineClock, tone: "amber" },
      { label: "Completed", value: bookings.filter((booking) => booking.status === "completed").length, icon: HiOutlineCheckCircle, tone: "green" },
      { label: "Today Revenue", value: formatCurrency(todayRevenue), icon: HiOutlineBanknotes, tone: "blue" },
    ];
  }, [bookings, transactions]);

  const upcomingBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== "cancelled" && booking.status !== "completed").slice(0, 5),
    [bookings]
  );

  return (
    <StaffWorkspace
      title="Staff Dashboard"
      eyebrow="Branch operations"
      actions={
        <>
          <Link to="/staff/bookings" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)] transition hover:bg-[#B94B86]">
            <HiOutlineClipboardDocumentCheck className="h-5 w-5" />
            Manage Bookings
          </Link>
          <Link to="/staff/transactions" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D65A9A]/25 bg-white px-4 py-2 text-sm font-bold text-[#1F2937] transition hover:bg-[#FFF0F7]">
            <HiOutlineBanknotes className="h-5 w-5 text-[#D65A9A]" />
            Payments
          </Link>
        </>
      }
    >
      {error && <ErrorNotice message={error} onRetry={loadDashboard} />}

      <section className="rounded-[1.5rem] bg-gradient-to-br from-[#D65A9A] via-[#E879B0] to-[#F8BBD6] p-5 text-white shadow-[0_24px_70px_rgba(214,90,154,0.24)] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <span className="inline-flex rounded-full border border-white/45 bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm backdrop-blur">
              Happy Skin Salon
            </span>
            <h2 className="mt-5 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
              Keep every appointment calm, clear, and paid before close.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/90">
              Review today's queue, confirm arrivals, complete services, and encode payments from one responsive staff workspace.
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-white/45 bg-white/20 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Next active booking</p>
            {upcomingBookings[0] ? (
              <div className="mt-3 rounded-2xl bg-white/90 p-4 text-[#1F2937]">
                <p className="font-bold">{upcomingBookings[0].service?.name}</p>
                <p className="mt-1 text-sm text-[#6B7280]">{upcomingBookings[0].customer?.full_name}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <StatusBadge status={upcomingBookings[0].status} />
                  <span className="text-xs font-semibold text-[#6B7280]">{formatDateTime(upcomingBookings[0].appointment_date)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl bg-white/90 p-4 text-sm font-semibold text-[#6B7280]">No active bookings in the current queue.</div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#1F2937]">Live Booking Queue</h2>
            <Link to="/staff/bookings" className="text-sm font-bold text-[#C85B95] hover:underline">View all</Link>
          </div>
          {isLoading ? (
            <CardSkeleton rows={4} />
          ) : upcomingBookings.length ? (
            <div className="space-y-3">
              {upcomingBookings.map((booking) => <BookingPreview key={booking.id} booking={booking} />)}
            </div>
          ) : (
            <EmptyState title="No active queue" description="Pending and confirmed branch bookings will appear here once customers schedule their visits." />
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#1F2937]">Recent Payments</h2>
            <Link to="/staff/transactions" className="text-sm font-bold text-[#C85B95] hover:underline">Open ledger</Link>
          </div>
          {isLoading ? (
            <CardSkeleton rows={3} />
          ) : transactions.length ? (
            <div className="space-y-3">
              {transactions.map((transaction) => <TransactionPreview key={transaction.id} transaction={transaction} />)}
            </div>
          ) : (
            <EmptyState icon={HiOutlineBanknotes} title="No payments yet" description="Encoded payments will be listed here with amount, staff, and booking reference." />
          )}
        </section>
      </div>
    </StaffWorkspace>
  );
}

function BookingPreview({ booking }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#1F2937]">{booking.service?.name || "Service"}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{booking.customer?.full_name || "Customer"} • {formatDateTime(booking.appointment_date)}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#6B7280]">
        <span className="inline-flex items-center gap-1"><HiOutlineUserGroup className="h-4 w-4 text-[#D65A9A]" /> {booking.branch?.name || "Branch"}</span>
        <span className="inline-flex items-center gap-1"><HiOutlineSparkles className="h-4 w-4 text-[#D65A9A]" /> {formatCurrency(booking.service?.price)}</span>
      </div>
    </article>
  );
}

function TransactionPreview({ transaction }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-[#1F2937]">{formatCurrency(transaction.amount)}</p>
          <p className="mt-1 text-sm text-[#6B7280]">Booking #{transaction.booking?.id} • {transaction.payment_method?.replace("_", " ")}</p>
        </div>
        <span className="rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-bold text-[#166534]">Paid</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-[#9CA3AF]">{formatDateTime(transaction.created_at)}</p>
    </article>
  );
}
