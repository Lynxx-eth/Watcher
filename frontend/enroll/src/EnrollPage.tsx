import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Backdrop, Chip, DataRows, FictionBanner, Logo, Panel, TechButton, TechInput, useReducedMotion } from "@watcher/ui";
import { ApiError, enroll, MAIN_SITE_URL, uploadMyPhoto, type EnrollPayload, type SessionInfo } from "./api";
import "./EnrollPage.css";

const THREATS = ["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"];
const WATCH = ["NONE", "ACTIVE", "PENDING", "CLEARED"];
const PRIORITY = ["LOW", "NORMAL", "HIGH"];
const BIO = ["NOT ON FILE", "ON FILE", "MATCH FOUND", "PENDING"];
const STEPS = ["Identity", "Location", "Display", "Notes", "Security"];
const MAX_PHOTO_MB = 5;

interface Form {
  fullName: string;
  dob: string;
  nationality: string;
  gender: string;
  title: string;
  country: string;
  region: string;
  city: string;
  address: string;
  postal: string;
  showAddress: boolean;
  classification: string;
  threat: string;
  watch: string;
  risk: number;
  priority: string;
  facial: string;
  fingerprint: string;
  iris: string;
  dna: string;
  description: string;
  notes: string;
  pin: string;
  pin2: string;
  consent: boolean;
}

const INITIAL: Form = {
  fullName: "", dob: "", nationality: "", gender: "", title: "",
  country: "", region: "", city: "", address: "", postal: "", showAddress: false,
  classification: "RESTRICTED", threat: "LOW", watch: "NONE", risk: 25, priority: "NORMAL",
  facial: "ON FILE", fingerprint: "ON FILE", iris: "PENDING", dna: "NOT ON FILE",
  description: "", notes: "", pin: "", pin2: "", consent: false,
};

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="w-field">
      <span className="w-field__label">{label}</span>
      <select className="w-input enr-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

/** Returns an error message for the given step, or null if it's valid. */
function validate(step: number, f: Form): string | null {
  if (step === 0) {
    if (f.fullName.trim().length < 2) return "Enter your full name.";
    if (!f.dob) return "Enter your date of birth.";
    if (f.nationality.trim().length < 2) return "Enter your nationality.";
  }
  if (step === 1 && (!f.city.trim() || !f.country.trim())) return "City and country are required.";
  if (step === 4) {
    if (!/^\d{4,12}$/.test(f.pin)) return "PIN must be 4–12 digits.";
    if (f.pin !== f.pin2) return "PINs do not match.";
    if (!f.consent) return "Please confirm this profile is about you.";
  }
  return null;
}

function toPayload(f: Form): EnrollPayload {
  const n = (s: string) => s.trim() || null;
  return {
    full_name: f.fullName.trim(),
    date_of_birth: f.dob,
    nationality: f.nationality.trim(),
    gender: n(f.gender),
    title: f.title.trim(),
    description: f.description.trim(),
    location: { country: f.country.trim(), region: n(f.region), city: f.city.trim(), address: n(f.address), postal_code: n(f.postal), show_address: f.showAddress },
    classification: f.classification.trim() || "RESTRICTED",
    threat_level: f.threat,
    watchlist_status: f.watch,
    risk_score: f.risk,
    priority: f.priority,
    biometrics: { facial: f.facial, fingerprint: f.fingerprint, iris: f.iris, dna: f.dna },
    case_notes: f.notes.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20),
    pin: f.pin,
    pin_confirm: f.pin2,
    consent_own_profile: f.consent,
  };
}

export function EnrollPage() {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(INITIAL);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ session: SessionInfo; photoWarning: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function pickPhoto(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Photo must be JPEG, PNG or WebP.");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return setError(`Photo must be under ${MAX_PHOTO_MB} MB.`);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function next() {
    const e = validate(step, f);
    if (e) return setError(e);
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    for (let i = 0; i < STEPS.length; i++) {
      const e = validate(i, f);
      if (e) {
        setStep(i);
        return setError(e);
      }
    }
    setBusy(true);
    setError(null);
    try {
      const session = await enroll(toPayload(f));
      let photoWarning: string | null = null;
      if (photo) {
        try {
          await uploadMyPhoto(photo);
        } catch (e) {
          photoWarning = `Profile created, but the photo was rejected: ${e instanceof ApiError ? e.message : "upload failed"}. You can add one later.`;
        }
      }
      setF((prev) => ({ ...prev, pin: "", pin2: "" }));
      setDone({ session, photoWarning });
    } catch (e) {
      setError(e instanceof ApiError ? (e.status === 429 ? "Too many profiles created from this network. Try again later." : e.message) : "Enrolment failed.");
    } finally {
      setBusy(false);
    }
  }

  const sections: ReactNode[] = [
    <div className="enr-grid" key="id">
      <div className="enr-photo">
        <div className="enr-photo__frame">
          {preview ? <img src={preview} alt="Selected profile photo preview" /> : <span className="w-label">No photo</span>}
        </div>
        <label className="w-btn w-btn--ghost w-btn--sm enr-photo__btn">
          {photo ? "Change photo" : "Add photo (optional)"}
          <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </label>
        {photo && (
          <button type="button" className="enr-link" onClick={() => (setPhoto(null), setPreview(null))}>
            Remove
          </button>
        )}
        <p className="w-field__hint">JPEG/PNG/WebP, max {MAX_PHOTO_MB} MB. Location data inside the file is removed on upload.</p>
      </div>
      <div className="enr-fields">
        <TechInput label="Full name *" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" />
        <TechInput label="Date of birth *" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} hint="You must be 18 or older." />
        <TechInput label="Nationality *" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
        <TechInput label="Gender (optional)" value={f.gender} onChange={(e) => set("gender", e.target.value)} />
        <TechInput label="Profile title" placeholder="e.g. Field Operative" value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
    </div>,
    <div className="enr-fields enr-fields--2" key="loc">
      <TechInput label="Country *" value={f.country} onChange={(e) => set("country", e.target.value)} autoComplete="country-name" />
      <TechInput label="State / region" value={f.region} onChange={(e) => set("region", e.target.value)} />
      <TechInput label="City *" value={f.city} onChange={(e) => set("city", e.target.value)} />
      <TechInput label="Postal code (optional)" value={f.postal} onChange={(e) => set("postal", e.target.value)} />
      <div className="enr-span">
        <TechInput label="Full address (optional)" value={f.address} onChange={(e) => set("address", e.target.value)} />
      </div>
      <label className="enr-check enr-span">
        <input type="checkbox" checked={f.showAddress} onChange={(e) => set("showAddress", e.target.checked)} />
        Show my full address on my console. If unchecked, only city and country are shown.
      </label>
      <p className="w-field__hint enr-span">
        To place your location on the confidential globe, the server looks up these location details with OpenStreetMap's
        geocoder (Nominatim). Leave the street address blank if you'd rather only your city is looked up.
      </p>
    </div>,
    <div className="enr-fields enr-fields--2" key="disp">
      <TechInput label="Classification label" value={f.classification} maxLength={40} onChange={(e) => set("classification", e.target.value)} />
      <Select label="Threat level" value={f.threat} options={THREATS} onChange={(v) => set("threat", v)} />
      <Select label="Watchlist status" value={f.watch} options={WATCH} onChange={(v) => set("watch", v)} />
      <Select label="Priority" value={f.priority} options={PRIORITY} onChange={(v) => set("priority", v)} />
      <label className="w-field enr-span">
        <span className="w-field__label">Risk score: {f.risk} / 100</span>
        <input type="range" min={0} max={100} value={f.risk} onChange={(e) => set("risk", Number(e.target.value))} className="enr-range" />
      </label>
      <Select label="Facial recognition" value={f.facial} options={BIO} onChange={(v) => set("facial", v)} />
      <Select label="Fingerprints" value={f.fingerprint} options={BIO} onChange={(v) => set("fingerprint", v)} />
      <Select label="Iris scan" value={f.iris} options={BIO} onChange={(v) => set("iris", v)} />
      <Select label="DNA profile" value={f.dna} options={BIO} onChange={(v) => set("dna", v)} />
      <p className="w-field__hint enr-span">These are display choices for your fictional console. No biometric data is collected.</p>
    </div>,
    <div className="enr-fields" key="notes">
      <label className="w-field">
        <span className="w-field__label">Profile description</span>
        <textarea className="w-input enr-textarea" maxLength={2000} value={f.description} onChange={(e) => set("description", e.target.value)} />
      </label>
      <label className="w-field">
        <span className="w-field__label">Case notes (one per line, up to 20)</span>
        <textarea className="w-input enr-textarea" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
    </div>,
    <div className="enr-fields" key="sec">
      <div className="enr-fields enr-fields--2">
        <TechInput label="Choose a PIN (4–12 digits) *" type="password" inputMode="numeric" autoComplete="new-password" value={f.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} hint="Avoid 1234, 0000 and similar." />
        <TechInput label="Repeat PIN *" type="password" inputMode="numeric" autoComplete="new-password" value={f.pin2} onChange={(e) => set("pin2", e.target.value.replace(/\D/g, ""))} />
      </div>
      <DataRows
        rows={[
          { k: "Name", v: f.fullName || "—" },
          { k: "Location", v: [f.city, f.country].filter(Boolean).join(", ") || "—" },
          { k: "Threat / watchlist", v: `${f.threat} · ${f.watch}` },
          { k: "Photo", v: photo ? photo.name : "None" },
        ]}
      />
      <label className="enr-check enr-consent">
        <input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>
          I confirm this profile is <strong>about me</strong>, that I'm creating it myself, and that I understand WATCHER is a
          fictional entertainment experience with no connection to any government or real watchlist.
        </span>
      </label>
    </div>,
  ];

  return (
    <div className="enr">
      <Backdrop />
      <FictionBanner />
      <div className="enr__wrap">
        <div className="enr__top">
          <Logo size={40} sub="Create your own profile" />
          <a href={`${MAIN_SITE_URL}/login`} className="w-label">Already have an ID? Sign in →</a>
        </div>

        {done ? (
          <motion.div initial={reduced ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 170, damping: 20 }}>
            <Panel title="Profile Created" code="ENR-OK">
              <div className="enr-done">
                <Chip tone="ok" solid>Enrolment complete</Chip>
                <span className="w-label">Your project ID</span>
                <div className="enr-done__id">{done.session.projectId}</div>
                <TechButton
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(done.session.projectId);
                    setCopied(true);
                  }}
                >
                  {copied ? "Copied" : "Copy ID"}
                </TechButton>
                <p className="enr-done__warn">Save this ID and your PIN somewhere safe. You'll need both to sign in; the PIN can't be shown again.</p>
                {done.photoWarning && <p className="w-c-warn">{done.photoWarning}</p>}
                <a className="w-btn" href={`${MAIN_SITE_URL}/login`}>
                  Go to sign-in
                </a>
              </div>
            </Panel>
          </motion.div>
        ) : (
          <Panel title={`Profile Enrolment — ${STEPS[step]}`} code={`ENR-0${step + 1}`}>
            <ol className="enr-steps" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className={i === step ? "is-on" : i < step ? "is-done" : ""} aria-current={i === step ? "step" : undefined}>
                  <span>{String(i + 1).padStart(2, "0")}</span> {s}
                </li>
              ))}
            </ol>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={reduced ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                {sections[step]}
              </motion.div>
            </AnimatePresence>

            {error && (
              <p className="w-field__error enr-error" role="alert">
                {error}
              </p>
            )}

            <div className="enr-nav">
              <TechButton variant="ghost" size="sm" disabled={step === 0 || busy} onClick={() => (setError(null), setStep((s) => s - 1))}>
                ‹ Back
              </TechButton>
              {step < STEPS.length - 1 ? (
                <TechButton size="sm" onClick={next}>
                  Next ›
                </TechButton>
              ) : (
                <TechButton size="sm" disabled={busy} onClick={() => void submit()}>
                  {busy ? "Creating…" : "Create my profile"}
                </TechButton>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
