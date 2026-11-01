export function SourceLink({ url }: { url?: string }) {
  if (!url) return null;
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* show the raw string */
  }
  return (
    <a className="source-link" href={url} target="_blank" rel="noopener noreferrer">
      Source: {host}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
