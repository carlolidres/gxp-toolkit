import type { ReactNode } from 'react'
import { Space, Typography } from 'antd'

const { Title, Paragraph, Text } = Typography

export function VrmsPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          {eyebrow ? (
            <Text className="eyebrow" type="secondary">
              {eyebrow}
            </Text>
          ) : null}
          <Title level={2} style={{ margin: 0 }}>
            {title}
          </Title>
          {description ? (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {description}
            </Paragraph>
          ) : null}
        </div>
        {actions ? <Space wrap>{actions}</Space> : null}
      </div>
      {children}
    </div>
  )
}
