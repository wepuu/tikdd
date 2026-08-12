import "@fontsource-variable/noto-sans-sc/wght.css";
import "@fontsource-variable/plus-jakarta-sans/wght.css";
import type { ReactNode } from "react";
import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
