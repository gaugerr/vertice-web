import App from './App';
import { accessConfig } from '../access/config';
import { AccessBoundary } from '../access/AccessBoundary';
export default function Root() {
  return accessConfig.enforced ? (
    <AccessBoundary>
      <App />
    </AccessBoundary>
  ) : (
    <App />
  );
}
