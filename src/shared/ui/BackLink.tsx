import { ArrowLeft } from 'lucide-react';
import { Link, type LinkProps } from 'react-router-dom';

type BackLinkProps = Pick<LinkProps, 'to' | 'children' | 'reloadDocument'>;

export function BackLink({ to, children, reloadDocument }: BackLinkProps) {
  return (
    <Link to={to} reloadDocument={reloadDocument} className="back-link">
      <ArrowLeft size={20} aria-hidden="true" />
      <span>{children}</span>
    </Link>
  );
}
