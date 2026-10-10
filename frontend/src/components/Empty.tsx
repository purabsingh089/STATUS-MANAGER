import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function Empty({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line/80 bg-slate-900/60 text-slate-500">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <div className="mt-3 text-sm font-medium text-slate-200">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
    </div>
  );
}