import type { ReactNode } from "react";

interface SectionHeaderProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function SectionHeader({ id, eyebrow, title, description, children }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      <p className="section-header__desc">{description}</p>
      {children}
    </header>
  );
}
