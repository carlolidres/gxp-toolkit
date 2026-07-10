import { Link } from 'react-router-dom'
import { Button, Result } from 'antd'
import { Home, SearchX } from 'lucide-react'

import { iconSize, iconStroke } from '../theme/iconSizes'

export function NotFoundPage() {
  return (
    <div className="not-found">
      <Result
        status="404"
        icon={<SearchX size={iconSize.dashboard} strokeWidth={iconStroke} aria-hidden />}
        title="Page not found"
        subTitle="The page may have moved or is unavailable for this workspace."
        extra={
          <Link to="/">
            <Button type="primary" icon={<Home size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />}>
              Return to dashboard
            </Button>
          </Link>
        }
      />
    </div>
  )
}
