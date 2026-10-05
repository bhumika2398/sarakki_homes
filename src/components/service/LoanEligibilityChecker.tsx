"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { ButtonFX } from "@/components/ui/ButtonFX";
import {
  APPLICANT_TYPES,
  EMAIL_RE,
  INDIAN_MOBILE_RE,
  LOAN_DOCUMENTS,
  type ApplicantType,
} from "@/lib/loanDocuments";

type EmploymentType = ApplicantType;

/**
 * "Check Your Loan Eligibility" — Bank Loan Arrangement service page
 * only. Salaried/Self Employed toggle drives which document checklist
 * shows; the form below submits to /api/loan-eligibility, which saves a
 * LoanApplication (linked to a Lead) — the same store the CRM form uses.
 */
export function LoanEligibilityChecker() {
  const [employmentType, setEmploymentType] = useState<EmploymentType>("Salaried");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Honeypot — mirrors ConsultationModal's convention.
  const [website, setWebsite] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const nameValid = name.trim().length >= 2;
  const phoneValid = INDIAN_MOBILE_RE.test(phone.replace(/\D/g, "").slice(-10));
  const emailValid = EMAIL_RE.test(email.trim());
  const formValid = nameValid && phoneValid && emailValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting" || status === "success" || !formValid) return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/loan-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, employmentType, website }),
      });

      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Couldn't reach the server. Please check your connection and try again.");
      setStatus("error");
    }
  };

  return (
    <>
      <h2 className="mt-14 font-display text-2xl">Check Your Loan Eligibility</h2>

      <div className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">I am:</p>
        <div className="inline-flex rounded-sm border border-border bg-surface p-1">
          {APPLICANT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setEmploymentType(type)}
              aria-pressed={employmentType === type}
              className={`rounded-sm px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${
                employmentType === type
                  ? "bg-accent-gold-dark text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={employmentType}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mt-5 rounded-md border border-border bg-surface p-6"
      >
        <p className="font-display text-lg">{employmentType} — required documents</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {LOAN_DOCUMENTS[employmentType].map((doc) => (
            <li key={doc.key} className="text-sm leading-relaxed text-foreground">
              {doc.label}
            </li>
          ))}
        </ul>
      </motion.div>

      {status === "success" ? (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-accent-gold/30 bg-accent-gold/10 p-6">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-accent-gold-dark" />
          <p className="text-sm leading-relaxed text-foreground">
            Thanks! Our loan team will contact you shortly.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5 sm:max-w-md" noValidate>
          {/* Honeypot — off-screen, not just visually hidden. */}
          <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
            <label htmlFor="loan-elig-website">Website</label>
            <input
              id="loan-elig-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-sm border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-accent-gold-dark"
          />
          <input
            type="tel"
            required
            placeholder="Phone number (10-digit mobile)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-sm border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-accent-gold-dark"
          />
          <input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-sm border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:border-accent-gold-dark"
          />

          {status === "error" && (
            <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "submitting" || !formValid}
            className={buttonClasses("primary", "relative w-full sm:w-fit")}
          >
            <ButtonFX />
            {status === "submitting" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </button>
        </form>
      )}
    </>
  );
}
