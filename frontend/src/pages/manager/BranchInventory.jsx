import { useCallback, useEffect, useMemo, useState } from "react";
import { HiOutlineArchiveBox, HiOutlineBanknotes, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineCube, HiOutlineExclamationTriangle, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatCurrency, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard } from "./ManagerWorkspace";

export default function BranchInventory() {
  const [data, setData] = useState({ items: [], low_stock_items: [], summary: {} });
  const [search, setSearch] = useState("");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await managerService.inventory());
    } catch (err) {
      setError(getApiError(err, "We couldn't load inventory status."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadInventory());
  }, [loadInventory]);

  const visibleItems = useMemo(() => {
    const source = showLowOnly ? data.low_stock_items || [] : data.items || [];
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter((item) => [item.name, item.sku, item.category, item.unit].join(" ").toLowerCase().includes(term));
  }, [data, search, showLowOnly]);

  useEffect(() => {
    setPage(1);
  }, [search, showLowOnly, pageSize]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = visibleItems.length ? (safePage - 1) * pageSize : 0;
  const paginatedItems = visibleItems.slice(startIndex, startIndex + pageSize);
  const pageStart = visibleItems.length ? startIndex + 1 : 0;
  const pageEnd = Math.min(startIndex + pageSize, visibleItems.length);
  const summary = data.summary || {};

  return (
    <ManagerWorkspace title="Inventory Status" eyebrow="Read-only branch stock">
      {error && <Notice message={error} onRetry={loadInventory} />}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tracked Items" value={summary.total_items || 0} icon={HiOutlineCube} tone="blue" />
        <StatCard label="Low Stock Alerts" value={summary.low_stock_count || 0} icon={HiOutlineExclamationTriangle} tone="red" />
        <StatCard label="Total Units" value={summary.total_units || 0} icon={HiOutlineArchiveBox} tone="pink" />
        <StatCard label="Stock Value" value={formatCurrency(summary.inventory_value)} icon={HiOutlineBanknotes} tone="green" />
      </section>

      <section className="mt-5 rounded-[1.5rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#D65A9A]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item, SKU, category, or unit"
              className="min-h-12 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-10 py-3 text-sm font-medium text-[#1F2937] outline-none transition focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            />
          </div>
          <div className="flex rounded-xl bg-[#FFF8FB] p-1">
            <button type="button" onClick={() => setShowLowOnly(false)} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold ${!showLowOnly ? "bg-[#C85B95] text-white" : "text-[#6B7280]"}`}>All Stock</button>
            <button type="button" onClick={() => setShowLowOnly(true)} className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold ${showLowOnly ? "bg-[#C85B95] text-white" : "text-[#6B7280]"}`}>Low Stock</button>
          </div>
          <label className="text-sm font-bold text-[#1F2937]">
            Rows
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="ml-2 min-h-10 rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20"
            >
              {[5, 10, 15, 25].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
      </section>

      {data.low_stock_items?.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-3 text-lg font-bold text-[#1F2937]">Low-Stock Alerts</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.low_stock_items.map((item) => <LowStockCard key={item.id} item={item} />)}
          </div>
        </section>
      )}

      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : visibleItems.length ? (
          <div className="overflow-hidden rounded-[1.25rem] border border-[#F3E8EF] bg-white shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
            <div className="hidden grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.7fr_0.8fr] gap-4 border-b border-[#F3E8EF] bg-[#FFF8FB] px-5 py-3 text-xs font-bold uppercase tracking-wide text-[#6B7280] lg:grid">
              <span>Item</span>
              <span>Category</span>
              <span>Stock</span>
              <span>Minimum</span>
              <span>Unit Cost</span>
              <span className="text-right">Status</span>
            </div>
            <div className="divide-y divide-[#F3E8EF]">
              {paginatedItems.map((item) => <InventoryRow key={item.id} item={item} />)}
            </div>
            <InventoryPagination
              page={safePage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={pageEnd}
              totalItems={visibleItems.length}
              onPageChange={setPage}
            />
          </div>
        ) : <EmptyState icon={HiOutlineCube} title="No inventory records" description="Inventory records for your assigned branch will appear here once products or supplies are encoded." />}
      </section>
    </ManagerWorkspace>
  );
}

function isLowStock(item) {
  return Number(item.quantity || 0) <= Number(item.minimum_stock || 0);
}

function InventoryPagination({ page, totalPages, pageStart, pageEnd, totalItems, onPageChange }) {
  const pages = getPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col gap-3 border-t border-[#F3E8EF] bg-[#FFF8FB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
      <p className="text-sm font-semibold text-[#6B7280]">
        Showing <span className="font-bold text-[#1F2937]">{pageStart}</span> to <span className="font-bold text-[#1F2937]">{pageEnd}</span> of <span className="font-bold text-[#1F2937]">{totalItems}</span> items
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D65A9A]/25 bg-white text-[#1F2937] transition hover:bg-[#FFF0F7] disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Previous page"
        >
          <HiOutlineChevronLeft className="h-5 w-5" />
        </button>
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={`h-10 min-w-10 rounded-xl px-3 text-sm font-bold transition ${
              pageNumber === page
                ? "bg-[#C85B95] text-white shadow-[0_10px_24px_rgba(200,91,149,0.24)]"
                : "border border-[#D65A9A]/25 bg-white text-[#1F2937] hover:bg-[#FFF0F7]"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#D65A9A]/25 bg-white text-[#1F2937] transition hover:bg-[#FFF0F7] disabled:cursor-not-allowed disabled:opacity-45"
          aria-label="Next page"
        >
          <HiOutlineChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function getPageNumbers(currentPage, totalPages) {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(1, Math.min(currentPage - halfWindow, totalPages - windowSize + 1));
  const end = Math.min(totalPages, start + windowSize - 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function LowStockCard({ item }) {
  return (
    <article className="rounded-[1.25rem] border border-[#FCA5A5]/45 bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-[#1F2937]">{item.name}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{item.category || "General"} • {item.sku || "No SKU"}</p>
        </div>
        <span className="rounded-full bg-[#FEE2E2] px-3 py-1 text-xs font-bold text-[#991B1B]">Low stock</span>
      </div>
      <p className="mt-4 text-sm text-[#6B7280]">Current: <span className="font-bold text-[#1F2937]">{item.quantity} {item.unit}</span> • Minimum: <span className="font-bold text-[#1F2937]">{item.minimum_stock} {item.unit}</span></p>
    </article>
  );
}

function InventoryRow({ item }) {
  const low = isLowStock(item);
  return (
    <article className="grid gap-3 px-4 py-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.7fr_0.8fr] lg:items-center lg:px-5">
      <div>
        <p className="font-bold text-[#1F2937]">{item.name}</p>
        <p className="mt-1 text-xs font-semibold text-[#9CA3AF]">{item.sku || "No SKU"}</p>
      </div>
      <p className="text-sm text-[#6B7280]">{item.category || "General"}</p>
      <p className="text-sm font-bold text-[#1F2937]">{item.quantity} {item.unit}</p>
      <p className="text-sm text-[#6B7280]">{item.minimum_stock} {item.unit}</p>
      <p className="text-sm text-[#6B7280]">{formatCurrency(item.unit_cost)}</p>
      <div className="text-left lg:text-right">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${low ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#DCFCE7] text-[#166534]"}`}>
          {low ? "Low stock" : "In stock"}
        </span>
      </div>
    </article>
  );
}
