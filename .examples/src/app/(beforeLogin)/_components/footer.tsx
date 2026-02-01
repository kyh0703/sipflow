import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t px-6 py-6 md:py-8">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Ansible Flow Editor
          </Link>
          <nav className="flex gap-4 sm:gap-6">
            <Link href="#" className="text-sm underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <Link href="#" className="text-sm underline-offset-4 hover:underline">
              Terms of Service
            </Link>
            <Link
              href="#"
              className="text-sm underline-offset-4 hover:underline"
            >
              Contact
            </Link>
          </nav>
        </div>
        <p className="text-muted-foreground text-center text-sm">
          &copy; {new Date().getFullYear()} Ansible Flow Editor. All rights
          reserved.
        </p>
      </div>
    </footer>
  )
}
