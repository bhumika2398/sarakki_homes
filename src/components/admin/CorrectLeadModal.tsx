"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { LocalityCombobox } from "@/components/admin/LocalityCombobox";
import { LEAD_PURPOSES, LEAD_SOURCES, POSSESSION_OPTIONS, PROPERTY_TYPES } from "@/lib/crm";
import { CORRECTABLE_FIELDS, validateLeadCorrection, type CorrectableField } from "@/lib/leadCorrection";

export interface CorrectableLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  propertyType: string | null;
  purpose: string;
  source: string;
  bedrooms: number | null;
  bathrooms: number | null;
  areaRequired: string | null;
  possession: string | null;
  budgetMinLakh: number | null;
  budgetMaxLakh: number | null;
}

const inputClass =
  "w-full rounded-sm border border-crm-border/40 bg-crm-bg/40 py-2.5 px-3 text-sm text-crm-text outline-none focus:border-crm-gold-bright/40";
const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-crm-text-secondary";

const toForm = (lead: CorrectableLead): Record<CorrectableField, string> => ({
  name: lead.name,
  phone: lead.phone,
  email: lead.email ?? "",
  location: lead.location ?? "",
  propertyType: lead.propertyType ?? "",
  purpose: lead.purpose,
  source: lead.source,
  bedrooms: lead.bedrooms?.toString() ?? "",
  bathrooms: lead.bathrooms?.toString() ?? "",
  areaRequired: lead.areaRequired ?? "",
  possession: lead.possession ?? "",
  budgetMinLakh: lead.budgetMinLakh?.toString() ?? "",
  budgetMaxLakh: lead.budgetMaxLakh?.toString() ?? "",
});

/** Options plus the lead's current value, so a legacy value (e.g. source
 *  "Loan Eligibility Form") isn't silently dropped by the dropdown. */
const withCurrent = (options: readonly string[], current: string) =>
  current && !options.includes(current) ? [current, ...options] : [...options];

export function CorrectLeadModal({
  lead,
  open,
  onClose,
  onSaved,
}: {
  lead: CorrectableLead;
  open: boolean;
  onClose: () => void;
  onSaved: (info: { changed: string[]; loanApplicationsUpdated: number }) => void;
}) {
  const [form, setForm] = useState(() => toForm(lead));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<{ id: string; name: string } | null>(null);
  const [localities, setLocalities] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    // Re-seed from the latest lead each time the dialog opens.
    setForm(toForm(lead));
    setError("");
    setConflict(null);
    fetch("/api/localities")
      .then((r) => r.json())
      .then((d) => setLocalities(d.localities ?? []))
      .catch(() => {});
  }, [open, lead]);

  const update = (key: CorrectableField, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setConflict(null);

    // Send only what changed; the same validator the server runs.
    const original = toForm(lead);
    const changed = Object.fromEntries(
      (Object.keys(form) as CorrectableField[]).filter((k) => form[k].trim() !== original[k].trim()).map((k) => [k, form[k]])
    );
    if (Object.keys(changed).length === 0) {
      setError("Nothing has changed.");
      return;
    }
    const check = validateLeadCorrection(changed);
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/correct`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.conflict) setConflict(data.conflict);
        throw new Error(data.error || "Couldn't save the correction.");
      }
      onSaved({ changed: data.changed ?? [], loanApplicationsUpdated: data.loanApplicationsUpdated ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the correction.");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: CorrectableField, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <label className={labelClass} htmlFor={`fix-${key}`}>{CORRECTABLE_FIELDS[key]}</label>
      <input id={`fix-${key}`} className={inputClass} value={form[key]} onChange={(e) => update(key, e.target.value)} {...props} />
    </div>
  );

  const select = (key: CorrectableField, options: readonly string[], allowEmpty = false) => (
    <div className="space-y-1.5">
      <label className={labelClass} htmlFor={`fix-${key}`}>{CORRECTABLE_FIELDS[key]}</label>
      <select id={`fix-${key}`} className={inputClass} value={form[key]} onChange={(e) => update(key, e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {withCurrent(options, lead[key as keyof CorrectableLead]?.toString() ?? "").map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );

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
            onClick={(e) => e.stopPropagation()}
            className="scrollbar-thin max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-crm-border/40 bg-crm-card p-7 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-crm-border/20 pb-4">
              <div>
                <h3 className="crm-section-heading">Correct Lead Details</h3>
                <p className="mt-0.5 text-sm text-crm-text-secondary">
                  Fixes this lead in place. Every change is recorded in the Timeline.
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-sm p-1.5 text-crm-text-secondary hover:bg-crm-bg hover:text-crm-text">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              {error && (
                <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
                  {error}{" "}
                  {conflict && (
                    <Link href={`/admin/leads/${conflict.id}`} className="font-semibold underline">
                      Open {conflict.name}
                    </Link>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {field("name")}
                {field("phone", { type: "tel", inputMode: "tel" })}
                {field("email", { type: "email" })}
                <div className="space-y-1.5">
                  <label className={labelClass} htmlFor="fix-location">{CORRECTABLE_FIELDS.location}</label>
                  <LocalityCombobox id="fix-location" value={form.location} onChange={(v) => update("location", v)} options={localities} />
                </div>
                {select("propertyType", PROPERTY_TYPES, true)}
                {select("purpose", LEAD_PURPOSES)}
                {select("source", LEAD_SOURCES)}
                {select("possession", POSSESSION_OPTIONS, true)}
                {field("bedrooms", { type: "number", min: 0 })}
                {field("bathrooms", { type: "number", min: 0 })}
                {field("budgetMinLakh", { type: "number", min: 0, step: "any" })}
                {field("budgetMaxLakh", { type: "number", min: 0, step: "any" })}
                {field("areaRequired")}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-crm-border/20 pt-4">
                <button type="button" onClick={onClose} className="crm-btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="crm-btn-gold disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <span>Save correction</span>}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
