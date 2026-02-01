type TitleProps = {
  title: string
  children: (s: string) => React.ReactNode
}

export default function Title({ title, children }: Readonly<TitleProps>) {
  return <div className="text-2xl font-bold">{children(title)}</div>
}
