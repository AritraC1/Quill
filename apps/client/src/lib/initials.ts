// Avatar-initial helper: gives the two-letter fallback shown when no profile
// photo is set — first letter of the first name + first letter of the last
// name ("Aritra Chatterjee" -> "AC"); single-word names keep just one letter.

export function getInitials(name: string | undefined | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";

  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}
