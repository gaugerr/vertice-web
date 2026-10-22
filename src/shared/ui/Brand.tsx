export function Brand({ showMark = true }: { showMark?: boolean }) {
  return (
    <span className="brand-logo">
      {showMark && (
        <img className="brand-mark" src="/icons/icon.svg" width="40" height="40" alt="" />
      )}
      <span className="brand-name">
        vértice
        <span className="brand-dot" aria-hidden="true">
          .
        </span>
      </span>
    </span>
  );
}
