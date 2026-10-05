"use client";

import { useEffect, useState } from "react";
import { LocalityCombobox } from "@/components/admin/LocalityCombobox";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import {
  LEAD_SOURCES,
  LEAD_PURPOSES,
  PROPERTY_TYPES,
  PRIORITIES,
} from "@/lib/crm";

const inputClass =
  "w-full rounded-sm border border-crm-border/40 bg-crm-bg/40 py-2.5 px-3 text-sm text-crm-text outline-none focus:border-crm-gold-bright/40";
const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-crm-text-secondary";

export function AddLeadModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    location: "",
    budgetMinLakh: "",
    budgetMaxLakh: "",
    propertyType: PROPERTY_TYPES[0],
    purpose: LEAD_PURPOSES[0],
    source: LEAD_SOURCES[0],
    priority: "MEDIUM",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [localities, setLocalities] = useState<string[]>([]);

  useEffect(() => {
    if (!open || localities.length > 0) return;
    fetch("/api/localities")
      .then((r) => r.json())
      .then((d) => setLocalities(d.localities ?? []))
      .catch(() => {});
  }, [open, localities.length]);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create lead.");
      }
      setForm({
        name: "",
        phone: "",
        email: "",
        location: "",
        budgetMinLakh: "",
        budgetMaxLakh: "",
        propertyType: PROPERTY_TYPES[0],
        purpose: LEAD_PURPOSES[0],
        source: LEAD_SOURCES[0],
        priority: "MEDIUM",
      });
      onCreated();
      onClose();
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
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-sm border border-crm-border/40 bg-crm-card p-7 shadow-2xl scrollbar-thin"
          >
            <div className="flex items-center justify-between border-b border-crm-border/20 pb-4">
              <div>
                <h3 className="crm-section-heading">Add New Lead</h3>
                <p className="text-sm text-crm-text-secondary mt-0.5">
                  Capture a walk-in, call, or referral straight into the pipeline.
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-crm-bg text-crm-text-secondary hover:text-crm-text rounded-sm transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Full Name *</label>
                  <input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Ramesh Iyer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Phone *</label>
                  <input
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+91 98450 00000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Email</label>
                  <input
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="name@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Location</label>
                  <LocalityCombobox
                    value={form.location}
                    onChange={(next) => update("location", next)}
                    options={localities}
                    placeholder="Search locality…"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Budget Min (Lakh)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.budgetMinLakh}
                    onChange={(e) => update("budgetMinLakh", e.target.value)}
                    placeholder="50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Budget Max (Lakh)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={form.budgetMaxLakh}
                    onChange={(e) => update("budgetMaxLakh", e.target.value)}
                    placeholder="80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className={labelClass}>Property Type</label>
                  <select
                    className={inputClass}
                    value={form.propertyType}
                    onChange={(e) => update("propertyType", e.target.value)}
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Purpose</label>
                  <select
                    className={inputClass}
                    value={form.purpose}
                    onChange={(e) => update("purpose", e.target.value)}
                  >
                    {LEAD_PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Priority</label>
                  <select
                    className={inputClass}
                    value={form.priority}
                    onChange={(e) => update("priority", e.target.value)}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Source</label>
                <select
                  className={inputClass}
                  value={form.source}
                  onChange={(e) => update("source", e.target.value)}
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-crm-gold to-crm-gold-bright py-3 text-xs font-semibold uppercase tracking-wider text-black transition-all duration-300 hover:brightness-110 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <span>Create Lead</span>}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
