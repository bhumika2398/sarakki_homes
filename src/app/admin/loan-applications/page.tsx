"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, Loader2, Plus, X, ChevronDown, Target, Upload, ExternalLink, Check } from "lucide-react";
import {
  APPLICANT_TYPES,
  LOAN_DOCUMENTS,
  LOAN_STATUSES,
  LOAN_STATUS_BADGE_CLASS,
  LOAN_STATUS_LABEL,
  EMAIL_RE,
  INDIAN_MOBILE_RE,
  normalizePhone,
  type ApplicantType,
  type LoanStatus,
} from "@/lib/loanDocuments";
import { cn } from "@/lib/utils";

interface LoanDocRow {
  id: string;
  key: string;
  label: string;
  received: boolean;
  receivedAt: string | null;
  fileUrl: string | null;
}
interface LoanAppRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  applicantType: ApplicantType;
  status: LoanStatus;
  source: string;
  notes: string | null;
  createdAt: string;
  lead: { id: string; name: string } | null;
  documents: Pick<LoanDocRow, "id" | "received">[];
}

const inputClass =
  "w-full rounded-sm border border-crm-border/40 bg-crm-bg/40 py-2.5 px-3 text-sm text-crm-text outline-none focus:border-crm-gold-bright/40";
const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-crm-text-secondary";

export default function LoanApplicationsPage() {
  const [apps, setApps] = useState<LoanAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<LoanStatus | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const fetchApps = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/loan-applications");
      const data = await res.json();
      if (data.applications) setApps(data.applications);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount — state is set after the awaited fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchApps();
  }, [fetchApps]);

  const filtered = useMemo(
    () => (statusFilter ? apps.filter((a) => a.status === statusFilter) : apps),
    [apps, statusFilter]
  );

  const updateStatus = async (id: string, status: LoanStatus) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      const res = await fetch(`/api/admin/loan-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) fetchApps();
    } catch {
      fetchApps();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-title flex items-center gap-2.5">
            <Landmark size={22} className="text-crm-gold" />
            Loan Applications
          </h1>
          <p className="mt-0.5 text-sm text-crm-text-secondary">
            Loan eligibility checks from the website and from staff — one list, one document checklist each.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="crm-btn-gold">
          <Plus size={14} />
          <span>New application</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-sm border border-crm-gold/30 bg-crm-gold/10 px-4 py-3 text-sm text-crm-text">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss" className="text-crm-text-secondary hover:text-crm-text">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-sm border border-crm-border/20 bg-crm-card/25 p-3">
        <FilterChip active={statusFilter === ""} onClick={() => setStatusFilter("")}>
          All ({apps.length})
        </FilterChip>
        {LOAN_STATUSES.map((s) => (
          <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {LOAN_STATUS_LABEL[s]} ({apps.filter((a) => a.status === s).length})
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-sm border border-crm-border/20 bg-crm-card/25 py-24 text-sm font-semibold text-crm-text-secondary">
          <Loader2 size={24} className="animate-spin text-crm-gold-bright" />
          <span>Loading applications...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-sm border border-dashed border-crm-border/20 bg-crm-card/25 py-24 text-center text-sm text-crm-text-secondary">
          No loan applications here yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((app) => {
            const got = app.documents.filter((d) => d.received).length;
            const open = expandedId === app.id;
            return (
              <div key={app.id} className="rounded-sm border border-crm-border/20 bg-crm-card/25">
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1 basis-64">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="truncate text-sm font-semibold text-crm-text">{app.name}</span>
                      <span className="rounded-full border border-crm-border/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-crm-text-secondary">
                        {app.applicantType}
                      </span>
                      <span className="rounded-full border border-crm-border/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-crm-text-secondary">
                        {app.source}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-crm-text-secondary">
                      <span>{app.phone}</span>
                      <span className="break-all">{app.email}</span>
                      <span>
                        {new Date(app.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "Asia/Kolkata",
                        })}
                      </span>
                      {app.lead && (
                        <Link
                          href={`/admin/leads/${app.lead.id}`}
                          className="flex items-center gap-1.5 text-crm-gold transition-colors hover:text-crm-gold-bright"
                        >
                          <Target size={11} /> Lead
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-crm-text-secondary">
                      Docs {got}/{app.documents.length}
                    </span>
                    <select
                      value={app.status}
                      onChange={(e) => updateStatus(app.id, e.target.value as LoanStatus)}
                      aria-label={`Status for ${app.name}`}
                      className={cn(
                        "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold uppercase outline-none",
                        LOAN_STATUS_BADGE_CLASS[app.status]
                      )}
                    >
                      {LOAN_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LOAN_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setExpandedId(open ? null : app.id)}
                      aria-expanded={open}
                      className="crm-btn-secondary"
                    >
                      <span>Documents</span>
                      <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
                    </button>
                  </div>
                </div>

                {open && (
                  <DocumentChecklist
                    applicationId={app.id}
                    onChanged={(status) => {
                      // Reflect new received-count + auto-moved status in the row.
                      fetchApps();
                      if (status) setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, status } : a)));
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <NewApplicationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id, duplicate) => {
          setModalOpen(false);
          setNotice(
            duplicate
              ? "An open application for this person already exists — it was kept (nothing duplicated). Opened below."
              : "Application saved and linked to the lead."
          );
          setExpandedId(id);
          fetchApps();
        }}
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
        active ? "bg-crm-gold text-black" : "text-crm-text-secondary hover:text-crm-text"
      )}
    >
      {children}
    </button>
  );
}

function DocumentChecklist({
  applicationId,
  onChanged,
}: {
  applicationId: string;
  onChanged: (status?: LoanStatus) => void;
}) {
  const [docs, setDocs] = useState<LoanDocRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/loan-applications/${applicationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.application) setDocs(data.application.documents);
      })
      .catch(() => !cancelled && setError("Couldn't load documents."));
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const applyUpdate = (doc: LoanDocRow, status?: LoanStatus) => {
    setDocs((prev) => prev?.map((d) => (d.id === doc.id ? doc : d)) ?? prev);
    onChanged(status);
  };

  const toggleReceived = async (doc: LoanDocRow) => {
    setBusyId(doc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/loan-applications/${applicationId}/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received: !doc.received }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't update the document.");
      applyUpdate(data.document, data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the document.");
    } finally {
      setBusyId(null);
    }
  };

  const upload = async (doc: LoanDocRow, file: File) => {
    setBusyId(doc.id);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/admin/loan-applications/${applicationId}/documents/${doc.id}`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      applyUpdate(data.document, data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-t border-crm-border/20 px-5 py-4">
      {error && (
        <div className="mb-3 rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">{error}</div>
      )}
      {!docs ? (
        <div className="flex items-center gap-2 py-3 text-sm text-crm-text-secondary">
          <Loader2 size={14} className="animate-spin" /> Loading documents...
        </div>
      ) : (
        <ul className="divide-y divide-crm-border/20">
          {docs.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <label className="flex min-w-0 flex-1 basis-56 cursor-pointer items-center gap-3 text-sm text-crm-text">
                <input
                  type="checkbox"
                  checked={doc.received}
                  disabled={busyId === doc.id}
                  onChange={() => toggleReceived(doc)}
                  className="h-4 w-4 rounded border border-crm-border accent-crm-gold"
                />
                <span className={cn(doc.received && "text-crm-text-secondary line-through")}>{doc.label}</span>
                {doc.received && <Check size={13} className="text-emerald-400" aria-hidden="true" />}
              </label>

              <div className="flex items-center gap-2">
                {doc.fileUrl && (
                  <a
                    href={`/api/admin/loan-applications/${applicationId}/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="crm-btn-secondary"
                  >
                    <ExternalLink size={13} />
                    <span>View</span>
                  </a>
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[doc.id] = el;
                  }}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(doc, f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={busyId === doc.id}
                  onClick={() => fileInputs.current[doc.id]?.click()}
                  className="crm-btn-secondary disabled:opacity-50"
                >
                  {busyId === doc.id ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  <span>{doc.fileUrl ? "Replace" : "Upload"}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewApplicationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, duplicate: boolean) => void;
}) {
  const [applicantType, setApplicantType] = useState<ApplicantType>("Salaried");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameValid = name.trim().length >= 2;
  const phoneValid = INDIAN_MOBILE_RE.test(normalizePhone(phone));
  const emailValid = EMAIL_RE.test(email.trim());
  const formValid = nameValid && phoneValid && emailValid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/loan-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, applicantType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save the application.");
      setName("");
      setPhone("");
      setEmail("");
      onCreated(data.application.id, data.duplicate === true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="scrollbar-thin max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-sm border border-crm-border/40 bg-crm-card p-7 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-crm-border/20 pb-4">
              <div>
                <h3 className="crm-section-heading">New Loan Application</h3>
                <p className="mt-0.5 text-sm text-crm-text-secondary">Same form and checklist as the website.</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-sm p-1.5 text-crm-text-secondary transition-colors hover:bg-crm-bg hover:text-crm-text"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <div className="space-y-1.5">
                <span className={labelClass}>Applicant is</span>
                <div className="flex gap-1 rounded-sm border border-crm-border/40 bg-crm-bg/40 p-1">
                  {APPLICANT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={applicantType === t}
                      onClick={() => setApplicantType(t)}
                      className={cn(
                        "flex-1 rounded-sm px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                        applicantType === t ? "bg-crm-gold text-black" : "text-crm-text-secondary hover:text-crm-text"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-sm border border-crm-border/20 bg-crm-bg/40 p-4">
                <p className={labelClass}>{applicantType} — required documents</p>
                <ul className="mt-2.5 space-y-1.5 text-sm text-crm-text">
                  {LOAN_DOCUMENTS[applicantType].map((d) => (
                    <li key={d.key}>• {d.label}</li>
                  ))}
                </ul>
              </div>

              {error && (
                <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">{error}</div>
              )}

              <div className="space-y-1.5">
                <label className={labelClass} htmlFor="loan-name">Full Name *</label>
                <input id="loan-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ramesh Iyer" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="loan-phone">Phone *</label>
                  <input
                    id="loan-phone"
                    type="tel"
                    className={inputClass}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile"
                  />
                  {phone && !phoneValid && <p className="text-xs text-red-400">Enter a valid 10-digit mobile number.</p>}
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="loan-email">Email *</label>
                  <input
                    id="loan-email"
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                  />
                  {email && !emailValid && <p className="text-xs text-red-400">Enter a valid email address.</p>}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-crm-border/20 pt-4">
                <button type="button" onClick={onClose} className="crm-btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={!formValid || saving} className="crm-btn-gold disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <span>Submit</span>}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
