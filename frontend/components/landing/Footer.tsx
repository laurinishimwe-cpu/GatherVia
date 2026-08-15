import Image from "next/image";

const socialLinks = [
  { name: "Facebook", url: "#", icon: "/Facebook-Logo.svg" },
  { name: "Instagram", url: "#", icon: "/Instagram-logo.svg" },
  { name: "X (Twitter)", url: "#", icon: "/X-logo.svg" },
  { name: "WhatsApp", url: "#", icon: "/Whatsapp-logo.svg" },
  { name: "YouTube", url: "#", icon: "/Youtube-logo.svg" },
];

export function Footer() {
  return (
    <footer className="bg-background border-t border-brand-400/10">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold tracking-widest text-brand-400">GATHERVIA</p>
            <p className="mt-1 text-xs opacity-70">Effortless event entry, from invitation to check‑in.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 sm:gap-4">
            {socialLinks.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-full border border-brand-400/20 p-2 transition hover:border-brand-400/50 hover:bg-brand-400/10"
                aria-label={link.name}
              >
                <Image
                  src={link.icon}
                  alt=""
                  width={24}
                  height={24}
                  className="h-5 w-5 opacity-70 transition group-hover:opacity-100 sm:h-6 sm:w-6"
                />
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t border-brand-400/10 pt-6 text-center text-xs opacity-50">
          <p>© {new Date().getFullYear()} GatherVia. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
