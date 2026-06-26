import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="not-found"><span>404</span><h1>Page not found</h1><p>The page may have moved or is unavailable for this workspace.</p><Link className="button primary" to="/">Return to dashboard</Link></div>
}
