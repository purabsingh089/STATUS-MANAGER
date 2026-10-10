import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  raised = false,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  return (
    <section className={`${raised ? "glass-raised" : "glass"} rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon}
            <div>
              {title ? (
                <h2 className="text-sm font-medium tracking-wide text-slate-200">{title}</h2>
              ) : (
                <span />
              )}
              {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}