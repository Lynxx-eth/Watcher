import "./SubjectPhoto.css";

/** Owner's photo in a bracketed frame, or an honest "no photo" silhouette. */
export function SubjectPhoto({ url, name, variant = "dossier" }: { url: string | null; name: string; variant?: "dossier" | "scan" }) {
  return (
    <div className={`photo photo--${variant}`}>
      {url ? (
        <img src={url} alt={`Profile photo of ${name}`} loading="lazy" />
      ) : (
        <div className="photo__empty">
          <svg viewBox="0 0 100 120" aria-hidden>
            <circle cx="50" cy="42" r="20" />
            <path d="M14 118c4-26 20-38 36-38s32 12 36 38" />
          </svg>
          <span className="w-label">No photo on file</span>
        </div>
      )}
      {variant === "scan" && <div className="photo__mesh" aria-hidden />}
      {variant === "scan" && <div className="photo__sweep" aria-hidden />}
    </div>
  );
}
