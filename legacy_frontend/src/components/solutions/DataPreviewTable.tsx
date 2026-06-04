export function DataPreviewTable({
  columns,
  rows,
  maxRows = 50,
}: {
  columns: string[];
  rows: Record<string, string | number>[];
  maxRows?: number;
}) {
  const visible = rows.slice(0, maxRows);
  return (
    <div className="overflow-auto border border-border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-surface-elevated/60 sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-mono text-[10px] tracking-wider text-muted-foreground uppercase whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i} className="border-t border-border hover:bg-surface-elevated/40">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 whitespace-nowrap">
                  {String(r[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-muted-foreground text-xs">
                No data yet — run a job or upload a dataset via Admin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground border-t border-border bg-surface-elevated/40">
          Showing {maxRows} of {rows.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
