export function AdStatusBadge({
  status,
  empty = "dash",
  className = "text-[11px]",
}: {
  status: string | null | undefined;
  empty?: "dash" | "none";
  className?: string;
}) {
  if (!status || status === "none") {
    return empty === "dash" ? <span className="text-gray-600">—</span> : null;
  }

  if (status.toUpperCase() === "TOP") {
    return (
      <span
        className={`rounded-full px-2 py-0.5 font-semibold text-white ${className}`}
        style={{ backgroundColor: "#1a6496" }}
      >
        TOP
      </span>
    );
  }

  if (status.toUpperCase() === "VIP") {
    return (
      <span
        className={`rounded-full px-2 py-0.5 font-semibold text-white ${className}`}
        style={{ backgroundColor: "#c0392b" }}
      >
        VIP
      </span>
    );
  }

  return (
    <span className={`rounded-full bg-gray-700 px-2 py-0.5 text-gray-300 ${className}`}>
      {status}
    </span>
  );
}
