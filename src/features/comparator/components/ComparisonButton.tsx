import { Scale } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { useOpenComparison } from '../context';

export function ComparisonButton() {
  const open = useOpenComparison();
  return <Button className="compare-button" variant="secondary" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); open(); }} aria-haspopup="dialog"><Scale size={18} aria-hidden="true" />Comparar</Button>;
}
