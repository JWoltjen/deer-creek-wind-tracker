import { usePersistedState } from "../hooks/usePersistedState";

export function CollapsiblePanel({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = usePersistedState<boolean>(`dc.collapsed.${id}`, false);
  return (
    <section className="panel">
      <button className="panel-head" aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
        <span className="section-title">{title}</span>
        <span className="chev">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && <div className="panel-body">{children}</div>}
    </section>
  );
}
