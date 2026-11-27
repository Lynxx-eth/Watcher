import { FICTION_NOTICE } from "@watcher/shared/constants";

/**
 * Always-on notice. Rendered by every layout in both apps;
 * not dismissible by design.
 */
export function FictionBanner() {
  return (
    <div className="w-fiction" role="note">
      <span aria-hidden>▲</span>
      <span>{FICTION_NOTICE}</span>
      <span aria-hidden>▲</span>
    </div>
  );
}
