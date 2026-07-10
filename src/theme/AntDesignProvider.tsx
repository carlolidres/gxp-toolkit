import { ConfigProvider, App as AntApp } from 'antd'
import type { ReactNode } from 'react'

import { useTheme } from '../hooks/useTheme'
import { createAntTheme } from './tokens'

import 'antd/dist/reset.css'
import '../styles/antd-overrides.css'

export function AntDesignProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const antdTheme = createAntTheme(theme)

  return (
    <ConfigProvider theme={antdTheme} wave={{ disabled: false }}>
      <AntApp className="gxp-antd-app">
        {children}
      </AntApp>
    </ConfigProvider>
  )
}
