"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MapPin, Pencil, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { LOCALITY_ZONES } from "@/lib/localityMatch";

interface LocalityRow {
  id: string;
  name: string;
  zone: string | null;
  properties: number;
  leads: number;
}

export default function LocalitiesPage() {
  const [rows, setRows] = useState<LocalityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editZone, setEditZone] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LocalityRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/localities");
      const data = await res.json();
      setMissingTable(data.missingTable === true);
      if (data.localities) setRows(data.localities);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Standard fetch-on-mount — state is set after the awaited fetch.
    load();
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase())),
    [rows, search]
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/localities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, zone: zone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add that locality.");
      setName("");
      setZone("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that locality.");
    } finally {
      setSubmitting(false);
    }
  };

  const saveEdit = async (id: string) => {
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/localities/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, zone: editZone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that change.");
      if (data.updated && (data.updated.properties || data.updated.leads)) {
        setNotice(`Renamed. Also updated ${data.updated.properties} properties and ${data.updated.leads} leads that used the old name.`);
      }
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that change.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/localities/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't delete.");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-title flex items-center gap-2.5">
          <MapPin size={22} className="text-crm-gold" />
          Localities
        </h1>
        <p className="mt-0.5 text-sm text-crm-text-secondary">
          The one Bengaluru area list used by the website filter and every CRM location picker.
        </p>
      </div>

      <form onSubmit={add} className="crm-card flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label className="crm-label" htmlFor="loc-name">Add locality</label>
          <input id="loc-name" className="crm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hulimavu" />
        </div>
        <div className="space-y-1.5">
          <label className="crm-label" htmlFor="loc-zone">Zone</label>
          <select id="loc-zone" className="crm-select" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">—</option>
            {LOCALITY_ZONES.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={submitting || !name.trim()} className="crm-btn-gold disabled:opacity-50">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <span>Add</span>}
        </button>
      </form>

      {missingTable && (
        <div className="rounded-sm border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Locality table not created yet — run the migration (<code>npx prisma db push</code>), then the locality seed
          script. Until then the website and pickers use the built-in static list.
        </div>
      )}
      {error && <div className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-sm border border-crm-gold/30 bg-crm-gold/10 px-4 py-3 text-sm text-crm-text">{notice}</div>}

      <input
        className="crm-input max-w-sm"
        placeholder="Search localities…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search localities"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-crm-gold" /></div>
      ) : (
        <div className="crm-card divide-y divide-crm-border">
          {visible.length === 0 && (
            <p className="p-6 text-sm text-crm-text-secondary">
              {rows.length === 0 ? "The list is empty — run the locality seed script." : "No matches."}
            </p>
          )}
          {visible.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              {editId === r.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input className="crm-input max-w-xs" value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Locality name" />
                  <select className="crm-select max-w-[140px]" value={editZone} onChange={(e) => setEditZone(e.target.value)} aria-label="Zone">
                    <option value="">—</option>
                    {LOCALITY_ZONES.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                  <button onClick={() => saveEdit(r.id)} className="crm-btn-gold !px-3" aria-label="Save"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="crm-btn-secondary !px-3" aria-label="Cancel"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-sm font-semibold text-crm-text">{r.name}</span>
                    {r.zone && <span className="ml-2 text-xs text-crm-text-muted">{r.zone}</span>}
                    <span className="ml-3 text-xs text-crm-text-secondary">
                      {r.properties} properties · {r.leads} leads
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditId(r.id);
                        setEditName(r.name);
                        setEditZone(r.zone ?? "");
                      }}
                      className="crm-btn-secondary !px-3"
                      aria-label={`Edit ${r.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(r)} className="crm-btn-secondary !px-3" aria-label={`Delete ${r.name}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Remove "${deleteTarget?.name ?? ""}"?`}
        message={`It disappears from every picker. Existing properties and leads keep their text (${deleteTarget?.properties ?? 0} properties, ${deleteTarget?.leads ?? 0} leads use it).`}
        confirmLabel="Remove"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
