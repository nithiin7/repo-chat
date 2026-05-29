export const Section = ({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) => (
  <div className="flex flex-col rounded-xl border border-border bg-card p-6">
    <div className="mb-6 flex items-center gap-3">
      <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-muted">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    {children}
  </div>
)

export const Field = ({
  label,
  badge,
  children,
}: {
  label: string
  badge?: React.ReactNode
  children: React.ReactNode
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {badge}
    </div>
    {children}
  </div>
)
