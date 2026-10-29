export function EyeIcon({ closed }: { closed: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.9 10s2.9-5 8.1-5 8.1 5 8.1 5-2.9 5-8.1 5S1.9 10 1.9 10Z" />
      <circle cx="10" cy="10" r="2.2" />
      {closed && <path d="m3.4 3.4 13.2 13.2" />}
    </svg>
  )
}

export function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.4" y="8.6" width="11.2" height="8" rx="2" />
      <path d={locked ? 'M6.9 8.6V6.4a3.1 3.1 0 0 1 6.2 0v2.2' : 'M6.9 8.6V6.4a3.1 3.1 0 0 1 5.7-1.6'} />
      <circle cx="10" cy="12.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.6 5.6h4.2l1.5 1.9h9.1v7.1a1.6 1.6 0 0 1-1.6 1.6H4.2a1.6 1.6 0 0 1-1.6-1.6V5.6Z" />
    </svg>
  )
}

export function RoomPackIcon() {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2.5 6 7.5-4 7.5 4v8L10 18l-7.5-4V6Zm0 0 7.5 4 7.5-4M10 10v8" /></svg>
}
