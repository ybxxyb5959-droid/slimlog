import { Toaster as Sonner, type ToasterProps } from 'sonner'

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        style: {
          background: 'var(--text)',
          color: 'var(--surface)',
          border: 'none',
          borderRadius: '14px',
          fontFamily: 'var(--font-sans)',
        },
      }}
      {...props}
    />
  )
}
