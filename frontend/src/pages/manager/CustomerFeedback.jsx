import { useCallback, useEffect, useState } from "react";
import { HiOutlineChatBubbleLeftRight, HiOutlineStar } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { formatDateTime, getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, EmptyState, ManagerWorkspace, Notice, StatCard } from "./ManagerWorkspace";

export default function CustomerFeedback() {
  const [data, setData] = useState({ feedback: [], average_rating: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setData(await managerService.feedback());
    } catch (err) {
      setError(getApiError(err, "We couldn't load customer feedback."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadFeedback());
  }, [loadFeedback]);

  return (
    <ManagerWorkspace title="Customer Feedback" eyebrow="Ratings for your branch">
      {error && <Notice message={error} onRetry={loadFeedback} />}
      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Average Rating" value={Number(data.average_rating || 0).toFixed(1)} icon={HiOutlineStar} tone="amber" />
        <StatCard label="Reviews" value={data.total || 0} icon={HiOutlineChatBubbleLeftRight} tone="pink" />
      </section>
      <section className="mt-5">
        {isLoading ? <CardSkeleton rows={5} /> : data.feedback?.length ? (
          <div className="space-y-3">{data.feedback.map((item) => <FeedbackCard key={item.id} item={item} />)}</div>
        ) : <EmptyState icon={HiOutlineStar} title="No feedback yet" description="Customer ratings for completed bookings in your branch will appear here." />}
      </section>
    </ManagerWorkspace>
  );
}

function FeedbackCard({ item }) {
  return (
    <article className="rounded-[1.25rem] border border-[#F3E8EF] bg-white p-4 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold text-[#1F2937]">{item.customer?.full_name || "Customer"}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{item.booking?.service || "Service"} • {formatDateTime(item.created_at)}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF3C7] px-3 py-1 text-xs font-bold text-[#92400E]">
          <HiOutlineStar className="h-4 w-4" /> {item.rating}/5
        </span>
      </div>
      {item.review && <p className="mt-4 rounded-xl bg-[#FFF8FB] px-3 py-2 text-sm leading-6 text-[#6B7280]">{item.review}</p>}
    </article>
  );
}
