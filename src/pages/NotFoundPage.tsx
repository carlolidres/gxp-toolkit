import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return <div className="not-found"><span>404</span><h1>This route is not in the template.</h1><p>The page may have moved, or you may be testing the fallback route.</p><Link className="button primary" to="/">Return to dashboard</Link></div>
}

