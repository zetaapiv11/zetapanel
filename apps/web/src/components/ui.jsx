export function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-panel-border bg-panel-surface p-5 ${className}`}>{children}</div>;
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-panel-accent text-white hover:bg-panel-accent/90',
    ghost: 'bg-transparent text-slate-300 hover:bg-white/5',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  };
  return (
    <button
      className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-panel-border bg-black/20 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-panel-accent focus:outline-none ${props.className || ''}`}
    />
  );
}

const STATUS_STYLES = {
  ONLINE: 'bg-emerald-500/15 text-emerald-400',
  CREATING: 'bg-amber-500/15 text-amber-400',
  BUILDING: 'bg-amber-500/15 text-amber-400',
  DEPLOYING: 'bg-amber-500/15 text-amber-400',
  FAILED: 'bg-red-500/15 text-red-400',
  SUSPENDED: 'bg-slate-500/15 text-slate-400',
  DELETED: 'bg-slate-500/15 text-slate-400',
  UNKNOWN: 'bg-slate-500/15 text-slate-400',
};

export function StatusBadge({ status }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.UNKNOWN}`}>
      {status}
    </span>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-panel-border py-16 text-center">
      <p className="text-slate-200 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-white/5 ${className}`} />;
}
