"use client";

interface PanelProps {
  title: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function Panel({ title, badge, badgeColor, children, className = "", headerRight }: PanelProps) {
  return (
    <div className={`flex flex-col rounded-lg border border-border bg-bg-panel overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {badge && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-full"
              style={{ backgroundColor: badgeColor || "var(--accent)", color: "#fff" }}
            >
              {badge}
            </span>
          )}
        </div>
        {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
}
