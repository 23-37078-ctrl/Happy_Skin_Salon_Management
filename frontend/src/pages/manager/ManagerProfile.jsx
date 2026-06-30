import { useCallback, useEffect, useState } from "react";
import { HiOutlineKey, HiOutlineUserCircle } from "react-icons/hi2";
import managerService from "../../services/managerService";
import { getApiError } from "../staff/staffWorkspaceUtils";
import { CardSkeleton, ManagerWorkspace, Notice, StatCard } from "./ManagerWorkspace";

export default function ManagerProfile() {
  const [profile, setProfile] = useState({ full_name: "", email: "", phone_number: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await managerService.profile();
      setProfile({ ...payload, phone_number: payload.phone_number || "" });
    } catch (err) {
      setError(getApiError(err, "We couldn't load your profile."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => loadProfile());
  }, [loadProfile]);

  const updateProfile = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      const updated = await managerService.updateProfile(profile);
      setProfile({ ...updated, phone_number: updated.phone_number || "" });
      setSuccess("Profile updated.");
    } catch (err) {
      setError(getApiError(err, "Couldn't update your profile."));
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await managerService.updatePassword(passwords);
      setPasswords({ current_password: "", new_password: "" });
      setSuccess("Password updated.");
    } catch (err) {
      setError(getApiError(err, "Couldn't update your password."));
    }
  };

  return (
    <ManagerWorkspace title="Profile" eyebrow="Manager account">
      {error && <Notice message={error} onRetry={loadProfile} />}
      {success && <Notice tone="success" message={success} />}
      {isLoading ? <CardSkeleton rows={2} /> : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Role" value={profile.role || "manager"} icon={HiOutlineUserCircle} tone="pink" />
            <StatCard label="Branch ID" value={profile.branch_id || "Assigned"} icon={HiOutlineUserCircle} tone="blue" />
          </section>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <form onSubmit={updateProfile} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
              <h2 className="text-lg font-bold text-[#1F2937]">Profile Details</h2>
              <Field label="Full name" value={profile.full_name} onChange={(value) => setProfile((prev) => ({ ...prev, full_name: value }))} />
              <Field label="Email" value={profile.email} disabled onChange={() => {}} />
              <Field label="Phone number" value={profile.phone_number} onChange={(value) => setProfile((prev) => ({ ...prev, phone_number: value }))} />
              <button type="submit" className="mt-4 min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white">Save Profile</button>
            </form>
            <form onSubmit={updatePassword} className="rounded-[1.5rem] border border-[#F3E8EF] bg-white p-5 shadow-[0_12px_34px_rgba(31,41,55,0.055)]">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[#1F2937]"><HiOutlineKey className="h-5 w-5 text-[#D65A9A]" /> Password</h2>
              <Field label="Current password" type="password" value={passwords.current_password} onChange={(value) => setPasswords((prev) => ({ ...prev, current_password: value }))} />
              <Field label="New password" type="password" value={passwords.new_password} onChange={(value) => setPasswords((prev) => ({ ...prev, new_password: value }))} />
              <button type="submit" className="mt-4 min-h-11 rounded-xl bg-[#C85B95] px-4 py-2 text-sm font-bold text-white">Update Password</button>
            </form>
          </div>
        </>
      )}
    </ManagerWorkspace>
  );
}

function Field({ label, value, onChange, type = "text", disabled = false }) {
  return (
    <label className="mt-4 block text-sm font-bold text-[#1F2937]">
      {label}
      <input type={type} value={value || ""} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#F3E8EF] bg-[#FFF8FB] px-3 py-2 text-sm outline-none focus:border-[#D65A9A] focus:ring-2 focus:ring-[#D65A9A]/20 disabled:text-[#9CA3AF]" />
    </label>
  );
}
