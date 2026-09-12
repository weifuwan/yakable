export function projectTitle(id: string): string {
  const base = id.replace(/-\d{4}-\d{2}-\d{2}T.*$/, "");
  return (base || id)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function projectDisplayName(project: { id: string; name?: string }): string {
  return project.name?.trim() || projectTitle(project.id);
}

export function editedLabel(updatedAt: string): string {
  const delta = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
