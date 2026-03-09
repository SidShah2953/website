import { useState, useEffect } from "react";

interface Props {
  src: string;
  filename?: string;
}

type SheetData = {
  names: string[];
  rows: Record<string, string[][]>;
};

export default function ExcelViewer({ src, filename = "model.xlsx" }: Props) {
  const [data, setData] = useState<SheetData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("xlsx"),
      fetch(src).then((res) => {
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        return res.arrayBuffer();
      }),
    ])
      .then(([XLSX, buffer]) => {
        if (cancelled) return;
        const wb = XLSX.read(buffer, { type: "array" });
        const rows: Record<string, string[][]> = {};
        for (const name of wb.SheetNames) {
          rows[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            header: 1,
            defval: "",
          }) as string[][];
        }
        setData({ names: wb.SheetNames, rows });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="not-prose my-6 rounded-lg border border-finance-cyan/20 bg-finance-cyan/5 p-8 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-finance-cyan border-t-transparent" />
        <p className="mt-3 text-sm text-neutral-400">Loading model…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="not-prose my-6 rounded-lg border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">Could not load the Excel model.</p>
        <a
          href={src}
          download={filename}
          className="mt-3 inline-block text-xs text-finance-cyan underline"
        >
          Download directly instead
        </a>
      </div>
    );
  }

  const sheetName = data.names[activeTab];
  const rows = data.rows[sheetName].filter((row) =>
    row.some((cell) => cell !== "" && cell != null)
  );

  return (
    <div className="not-prose my-6 rounded-lg border border-finance-cyan/20 overflow-hidden">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-finance-cyan/10 bg-finance-cyan/5 scrollbar-none">
        {data.names.map((name, i) => (
          <button
            key={name}
            onClick={() => setActiveTab(i)}
            className={`flex-shrink-0 px-4 py-2.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
              i === activeTab
                ? "border-b-2 border-finance-cyan text-finance-cyan"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-auto" style={{ maxHeight: "500px" }}>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={ri % 2 === 0 ? "bg-neutral-900/60" : "bg-neutral-900/30"}
              >
                {row.map((cell, ci) =>
                  ri === 0 ? (
                    <th
                      key={ci}
                      className="sticky top-0 border border-white/5 bg-finance-cyan/10 px-3 py-1.5 text-left font-medium text-finance-cyan whitespace-nowrap"
                    >
                      {cell ?? ""}
                    </th>
                  ) : (
                    <td
                      key={ci}
                      className="border border-white/5 px-3 py-1.5 text-neutral-300 whitespace-nowrap"
                    >
                      {cell ?? ""}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-center text-xs text-neutral-500">
            This sheet appears to be empty.
          </p>
        )}
      </div>
    </div>
  );
}
