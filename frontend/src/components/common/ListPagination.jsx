export const PAGE_SIZE = 10;

export default function ListPagination({ page, totalItems, onPageChange, pageSize = PAGE_SIZE, itemLabel = "records" }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return <p className="mt-4 text-center text-xs font-semibold text-[#6B7280]">Showing {totalItems} {itemLabel}</p>;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1);

  return <nav aria-label={`${itemLabel} pagination`} className="mt-5 flex flex-wrap items-center justify-center gap-2">
    <span className="mr-2 text-xs font-semibold text-[#6B7280]">Showing {start}–{end} of {totalItems}</span>
    <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="min-h-10 rounded-xl border border-[#F3E8EF] bg-white px-3 text-sm font-bold text-[#713B5A] disabled:opacity-40">Previous</button>
    {pages.map((number, index) => <span key={number} className="contents">{index > 0 && number - pages[index - 1] > 1 && <span className="px-1 text-[#9CA3AF]">…</span>}<button type="button" aria-current={number === page ? "page" : undefined} onClick={() => onPageChange(number)} className={`grid h-10 min-w-10 place-items-center rounded-xl text-sm font-bold ${number === page ? "bg-[#C85B95] text-white" : "border border-[#F3E8EF] bg-white text-[#713B5A]"}`}>{number}</button></span>)}
    <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="min-h-10 rounded-xl border border-[#F3E8EF] bg-white px-3 text-sm font-bold text-[#713B5A] disabled:opacity-40">Next</button>
  </nav>;
}
